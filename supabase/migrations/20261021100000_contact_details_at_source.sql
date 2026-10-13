-- ════════════════════════════════════════════════════════════════════
-- פרטי קשר של משתמשים: סגירה במקור
-- ════════════════════════════════════════════════════════════════════
-- המשך ל-20261021090000 (הפרופיל המלא). החלטת הבעלים: כמה שיותר להגביל
-- עקיפת המערכת. כאן נסגרים שני הדלפים הנוספים:
--
-- 1. shadchan_public_profiles (הפנימית): phone/email רק כש-auth.uid() הוא
--    השדכן עצמו או כש-is_admin(); אחרת NULL. כך כל הקוראים מכוסים:
--    get_shadchan_public_profile, get_shadchanim_who_acted_for_me,
--    list_approved_shadchanim (כבר NULL) ו-get_forum_author_names (שמות בלבד).
--    auth.uid() קורא את ה-JWT של הבקשה, ולכן נשאר המשתמש גם בקריאה
--    מקוננת בין פונקציות SECURITY DEFINER. get_shadchan_public_profile נשארת
--    עם ה-CASE שלה כהגנה בשכבה נוספת (חסר-נזק, אותה לוגיקה).
-- 2. get_user_metadata (צ'אט): 'email' רק למשתמש עצמו או למנהל; אחרת null.
--    שאר השדות ללא שינוי.
-- 3. user_profiles: המדיניות "Users can read profiles of users they chat
--    with" נתנה לשותף שיחה לקרוא ישירות את כל השורה, כולל email. כל הקריאות
--    של משתמש לשורות של אחרים עוברות ב-get_user_metadata, ולכן המדיניות
--    מצטמצמת לשורה של עצמי או מנהל.
--
-- אידמפוטנטית. ההרשאות והחתימות ללא שינוי.

-- ── 1. shadchan_public_profiles ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.shadchan_public_profiles(p_ids uuid[])
RETURNS TABLE (
  shadchan_id      uuid,
  first_name       text,
  last_name        text,
  avatar_url       text,
  since_year       integer,
  phone            text,
  email            text,
  city             text,
  description      text,
  experience_years integer,
  closed_matches   integer,
  specializations  text[],
  languages        text[]
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    u.id,
    COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
    COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), '')),
    NULLIF(BTRIM(u.raw_user_meta_data->>'avatar_url'), ''),
    CASE
      WHEN si.experience_years IS NOT NULL AND si.experience_years >= 0 THEN
        EXTRACT(YEAR FROM COALESCE(si.submitted_at, si.created_at))::integer - si.experience_years
      ELSE
        EXTRACT(YEAR FROM COALESCE(si.approved_at, si.submitted_at, si.created_at, u.created_at))::integer
    END,
    CASE WHEN auth.uid() = u.id OR public.is_admin()
         THEN NULLIF(BTRIM(si.contact_phone), '') END,
    CASE WHEN auth.uid() = u.id OR public.is_admin()
         THEN NULLIF(BTRIM(si.contact_email), '') END,
    NULLIF(BTRIM(si.location), ''),
    NULLIF(BTRIM(si.bio), ''),
    si.experience_years,
    si.closed_matches,
    COALESCE(si.specializations, '{}'),
    COALESCE(si.languages, '{}')
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN public.shadchanim_info si ON si.user_id = u.id
  WHERE u.id = ANY (p_ids);
$$;

ALTER FUNCTION public.shadchan_public_profiles(uuid[]) OWNER TO postgres;

COMMENT ON FUNCTION public.shadchan_public_profiles(uuid[])
  IS 'פנימית: שדות הכרטיס הציבורי של שדכנים. טלפון ואימייל רק לשדכן עצמו ולמנהל. ההרשאה נבדקת בפונקציות שקוראות לה.';

REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shadchan_public_profiles(uuid[]) TO service_role;

-- ── 2. get_user_metadata ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_metadata(target_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- אותו כלל כמו מדיניות "Users can read profiles of users they chat with",
  -- ובנוסף שדכן/מנהל
  IF target_user_id <> v_uid
     AND NOT public.is_shadchan_or_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.chat_room_participants crp1
       JOIN public.chat_room_participants crp2 ON crp1.room_id = crp2.room_id
       WHERE crp1.user_id = v_uid
         AND crp2.user_id = target_user_id
         AND crp1.deleted_before IS NULL
         AND crp2.deleted_before IS NULL
     ) THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', u.id,
      'firstName', COALESCE(
        NULLIF(TRIM(p.first_name), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'firstName'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), '')
      ),
      'lastName', COALESCE(
        NULLIF(TRIM(p.last_name), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'lastName'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), '')
      ),
      'email', CASE WHEN u.id = v_uid OR public.is_admin()
                    THEN COALESCE(p.email, u.email) END
    )
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE u.id = target_user_id
  );
END;
$$;

ALTER FUNCTION public.get_user_metadata(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_user_metadata(uuid)
  IS 'שם של משתמש לתצוגה בצ''אט (מהפרופיל ובהיעדרו מ-auth.users). רק לעצמי, לשותף בשיחה או לשדכן/מנהל. אימייל רק לעצמי ולמנהל.';

REVOKE ALL ON FUNCTION public.get_user_metadata(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_metadata(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_metadata(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_metadata(uuid) TO service_role;

-- ── 3. user_profiles: שורה של עצמי או מנהל ────────────────────────
DROP POLICY IF EXISTS "Users can read profiles of users they chat with" ON public.user_profiles;
DROP POLICY IF EXISTS "User_profiles select own or admin" ON public.user_profiles;
CREATE POLICY "User_profiles select own or admin" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR public.is_admin());

-- ── Rollback ──────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "User_profiles select own or admin" ON public.user_profiles;
-- CREATE POLICY "Users can read profiles of users they chat with" ON public.user_profiles
--   FOR SELECT TO authenticated
--   USING (((SELECT auth.uid()) = id) OR (EXISTS (
--     SELECT 1
--     FROM public.chat_room_participants crp1
--     JOIN public.chat_room_participants crp2 ON crp1.room_id = crp2.room_id
--     WHERE crp1.user_id = (SELECT auth.uid())
--       AND crp2.user_id = user_profiles.id
--       AND crp1.deleted_before IS NULL
--       AND crp2.deleted_before IS NULL)));
--
-- get_user_metadata: ההגדרה הקודמת ב-20260917100000_chat_display_names.sql
-- (אותו גוף, עם 'email', COALESCE(p.email, u.email) בלי CASE).
--
-- shadchan_public_profiles: ההגדרה הקודמת ב-20260910120000 (השורות
--   NULLIF(BTRIM(si.contact_phone), ''),
--   NULLIF(BTRIM(si.contact_email), ''),
-- בלי ה-CASE). את ההגדרות המלאות מריצים מהקבצים האלה.
