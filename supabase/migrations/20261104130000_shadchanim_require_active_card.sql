-- רשימת השדכנים והפנייה אליהם: רק למשתמש שיש לו כרטיס פעיל שגלוי לכל
-- השדכנים (בקשת ההנהלה). שדכנים, מנהלים ואנשי צוות פטורים.
--
-- "כרטיס פעיל וגלוי": לא נמחק, אושר בידי ההנהלה ואינו "בלעדי למנהל", לא
-- מושהה בידי מנהל, לא הוצא משידוכים בידי הבעלים, ואינו מאורס/נשוי.
--
-- האכיפה בפנייה עצמה נמצאת ב-claim_shadchan_contact, שנקראת גם מ-contact_shadchan
-- וגם מהטריגר על יצירת חדר צ'אט עם שדכן - כך אין עקיפה דרך צ'אט ישיר.
-- מענה לשדכן שהציע להורה שידוך נשאר פתוח (כמו בכלל המכסה היומית).

CREATE OR REPLACE FUNCTION public.has_active_public_card(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.students s
     WHERE s.user_id = uid
       AND s.deleted_at IS NULL
       AND s.admin_approved_at IS NOT NULL
       AND s.admin_exclusive_at IS NULL
       AND s.admin_paused_at IS NULL
       AND s.in_shidduchim IS DISTINCT FROM false
       AND s.personal_status NOT IN ('engaged', 'married')
  );
$function$;

ALTER FUNCTION public.has_active_public_card(uuid) OWNER TO postgres;
-- לא ל-authenticated: אחרת כל משתמש יכול לבדוק מצב כרטיס של משתמש אחר.
-- can_browse_shadchanim ו-claim_shadchan_contact הן SECURITY DEFINER וקוראות לה
REVOKE ALL ON FUNCTION public.has_active_public_card(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_public_card(uuid) TO service_role;

-- המשתמש המחובר רשאי לצפות ברשימת השדכנים ולפנות אליהם
CREATE OR REPLACE FUNCTION public.can_browse_shadchanim()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'shadchan')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
    OR public.has_active_public_card(auth.uid())
  );
$function$;

ALTER FUNCTION public.can_browse_shadchanim() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_browse_shadchanim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_browse_shadchanim() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_shadchan_contact(p_parent_id uuid, p_shadchan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_day  date := public.israel_today();
  v_used integer;
BEGIN
  IF p_parent_id IS NULL OR p_shadchan_id IS NULL THEN
    RETURN;
  END IF;
  IF public.is_shadchan_contact_limit_exempt(p_parent_id) THEN
    RETURN;
  END IF;
  -- מענה לשדכן שהציע להורה שידוך אינו פנייה חדשה
  IF p_shadchan_id IN (SELECT public.shadchanim_who_proposed_to_parent(p_parent_id)) THEN
    RETURN;
  END IF;

  -- פנייה חדשה לשדכן: רק עם כרטיס פעיל שגלוי לכל השדכנים (אנשי צוות פטורים).
  -- פנייה למנהל (תמיכה, "השבה להנהלה" בהודעת מערכת) תמיד פתוחה
  -- קוד שרת מהימן (service role, בלי סשן) אינו נחסם
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(p_shadchan_id, 'admin')
     AND NOT public.has_role(p_parent_id, 'staff')
     AND NOT public.has_active_public_card(p_parent_id) THEN
    RAISE EXCEPTION 'active_card_required'
      USING HINT = 'פנייה לשדכנים פתוחה למי שיש לו כרטיס פעיל ומאושר במערכת.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('shadchan_contacts'), hashtext(p_parent_id::text));

  IF EXISTS (
    SELECT 1 FROM public.shadchan_contacts c
    WHERE c.parent_id = p_parent_id
      AND c.contact_day = v_day
      AND c.shadchan_id = p_shadchan_id
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.shadchan_contacts c
  WHERE c.parent_id = p_parent_id
    AND c.contact_day = v_day;

  IF v_used >= public.shadchan_daily_contact_limit() THEN
    RAISE EXCEPTION 'daily_contact_limit_reached'
      USING HINT = 'הגעת למכסת הפניות היומית לשדכנים. ניתן יהיה לפנות לשדכנים נוספים מחר.';
  END IF;

  INSERT INTO public.shadchan_contacts (parent_id, shadchan_id, contact_day)
  VALUES (p_parent_id, p_shadchan_id, v_day)
  ON CONFLICT (parent_id, contact_day, shadchan_id) DO NOTHING;
END;
$function$;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   להחזיר את claim_shadchan_contact מ-20260910120000_shadchan_activity_and_contact_limit.sql
--   DROP FUNCTION IF EXISTS public.can_browse_shadchanim();
--   DROP FUNCTION IF EXISTS public.has_active_public_card(uuid);
