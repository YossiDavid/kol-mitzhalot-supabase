-- אישור כרטיס "להצעות ממני בלבד" (בלעדי למנהל): הכרטיס מאושר, אבל אינו מופיע
-- במאגר. רק מנהל מערכת רואה אותו (מלבד בעליו), מסמן אותו בכוכב, מעלה אותו ללוח
-- העבודה ושולח עליו הצעות. שדכן ואיש צוות אינם רואים אותו ואינם מציעים עליו.
--
-- המצב: admin_approved_at מלא (מאושר - בעל הכרטיס רואה "מאושר") וגם
-- admin_exclusive_at מלא. אישור מלא מאפס את admin_exclusive_at; החזרה להמתנה
-- ודחייה מאפסות את שניהם (נתיב המנהל, PATCH /api/v1/students/:id/approval).
--
-- למה "מאושר + דגל" ולא "ממתין + דגל": מי שקיבל הצעה מהמנהל (הצד השני) רואה את
-- הכרטיס דרך ההצעה (get_student_card_access -> 'proposal', get_my_shidduch_proposals,
-- can_view_student_photo), ואלה נשענים על admin_approved_at. כאן רק מוסתר
-- המאגר: students (מדיניות מגבילה), student_cards, הטבלאות המקושרות
-- (student_hidden_until_approved), רמת הגישה 'full' של שדכן/איש צוות, ושער ההצעות.
--
-- גופי הפונקציות הועתקו מההגדרה הקיימת במסד; התוספת מסומנת "חדש".
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. העמודות ──────────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admin_exclusive_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_exclusive_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.students.admin_exclusive_at IS
  'מתי הנהלת המערכת אישרה את הכרטיס להצעות של המנהל בלבד (null = לא בלעדי). כרטיס כזה מאושר, אבל אינו מוצג במאגר לשדכנים';

-- בלעדי רק לכרטיס מאושר
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_admin_exclusive_state_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_admin_exclusive_state_check CHECK (
    admin_exclusive_at IS NULL OR admin_approved_at IS NOT NULL
  );

-- ── 2. נעילה: רק מנהל / service role קובע אישור (כולל בלעדי) ─────────────
CREATE OR REPLACE FUNCTION public.enforce_student_admin_approval_lock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := v_uid IS NOT NULL AND COALESCE(public.is_admin(), false);
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NULL THEN
      RETURN NEW;
    END IF;
    IF v_is_admin THEN
      IF NEW.admin_approved_at IS NULL AND NEW.admin_rejected_at IS NULL THEN
        NEW.admin_approved_at := now();
        NEW.admin_approved_by := v_uid;
      END IF;
      RETURN NEW;
    END IF;
    NEW.admin_approved_at := NULL;
    NEW.admin_approved_by := NULL;
    NEW.admin_rejected_at := NULL;
    NEW.admin_rejected_by := NULL;
    NEW.admin_rejection_reason := NULL;
    -- חדש
    NEW.admin_exclusive_at := NULL;
    NEW.admin_exclusive_by := NULL;
    RETURN NEW;
  END IF;

  v_changed :=
    NEW.admin_approved_at IS DISTINCT FROM OLD.admin_approved_at
    OR NEW.admin_approved_by IS DISTINCT FROM OLD.admin_approved_by
    OR NEW.admin_rejected_at IS DISTINCT FROM OLD.admin_rejected_at
    OR NEW.admin_rejected_by IS DISTINCT FROM OLD.admin_rejected_by
    OR NEW.admin_rejection_reason IS DISTINCT FROM OLD.admin_rejection_reason
    -- חדש
    OR NEW.admin_exclusive_at IS DISTINCT FROM OLD.admin_exclusive_at
    OR NEW.admin_exclusive_by IS DISTINCT FROM OLD.admin_exclusive_by;

  IF NOT v_changed OR v_uid IS NULL OR v_is_admin THEN
    RETURN NEW;
  END IF;

  -- שליחה לאישור מחדש: בעל הכרטיס, כרטיס שנדחה, והתוצאה "ממתין" בלבד
  IF v_uid = OLD.user_id
     AND OLD.admin_rejected_at IS NOT NULL
     AND NEW.admin_approved_at IS NULL
     AND NEW.admin_approved_by IS NULL
     AND NEW.admin_rejected_at IS NULL
     AND NEW.admin_rejected_by IS NULL
     AND NEW.admin_rejection_reason IS NULL
     -- חדש
     AND NEW.admin_exclusive_at IS NULL
     AND NEW.admin_exclusive_by IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'student_approval_forbidden' USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.enforce_student_admin_approval_lock() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_student_admin_approval_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_enforce_student_admin_approval_lock ON public.students;
CREATE TRIGGER trigger_enforce_student_admin_approval_lock
  BEFORE INSERT OR UPDATE OF admin_approved_at, admin_approved_by,
    admin_rejected_at, admin_rejected_by, admin_rejection_reason,
    admin_exclusive_at, admin_exclusive_by
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_admin_approval_lock();

-- ── 3. עדכון: כרטיס שאינו גלוי במאגר - בעליו, מנהל או service role בלבד ──
CREATE OR REPLACE FUNCTION public.enforce_unapproved_card_writes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- חדש: גם כרטיס בלעדי למנהל
  IF (OLD.admin_approved_at IS NULL OR OLD.admin_exclusive_at IS NOT NULL)
     AND auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.user_id
     AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501',
      HINT = 'הכרטיס ממתין לאישור הנהלת המערכת';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_unapproved_card_writes() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_unapproved_card_writes() FROM PUBLIC, anon, authenticated;

-- ── 4. students: מדיניות מגבילה ───────────────────────────────────────
DROP POLICY IF EXISTS "Unapproved cards are read by owner and admin only" ON public.students;
CREATE POLICY "Unapproved cards are read by owner and admin only" ON public.students
  AS RESTRICTIVE FOR SELECT
  USING (
    -- חדש: כרטיס בלעדי למנהל - כמו כרטיס שאינו מאושר
    (admin_approved_at IS NOT NULL AND admin_exclusive_at IS NULL)
    OR (SELECT auth.uid()) = user_id
    OR public.is_admin()
  );

-- ── 5. הכלל לטבלאות המקושרות ולפונקציות (הערות, פידבק, הצעות, רפואי) ───
CREATE OR REPLACE FUNCTION public.student_hidden_until_approved(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((
    -- חדש: גם כרטיס בלעדי למנהל
    SELECT (s.admin_approved_at IS NULL OR s.admin_exclusive_at IS NOT NULL)
       AND s.user_id IS DISTINCT FROM auth.uid()
       AND NOT COALESCE(public.is_admin(), false)
      FROM public.students s
     WHERE s.id = p_student_id
  ), true);
$$;

ALTER FUNCTION public.student_hidden_until_approved(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.student_hidden_until_approved(uuid) IS
  'האם הכרטיס חבוי מהצופה הנוכחי כי הנהלת המערכת עוד לא אישרה אותו, או אישרה אותו להצעות המנהל בלבד (בעלים ומנהל רואים תמיד)';
REVOKE ALL ON FUNCTION public.student_hidden_until_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_hidden_until_approved(uuid) TO authenticated, service_role;

-- ── 6. רמת הגישה: שדכן ואיש צוות אינם מקבלים 'full' על כרטיס בלעדי ─────
-- מי שקיבל הצעה עליו (מהמנהל) ממשיך לקבל 'proposal'.
CREATE OR REPLACE FUNCTION public.get_student_card_access(sid uuid)
 RETURNS TABLE(access_level text, share_contact boolean, share_medical boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  WITH target AS (
    SELECT s.id, s.user_id, s.admin_approved_at, s.admin_exclusive_at
    FROM public.students s
    WHERE s.id = sid AND s.deleted_at IS NULL
  ),
  proposal AS (
    -- bool_or על פני כל ההצעות הרלוונטיות: להורה עם שני ילדים יכולות
    -- להיות שתי הצעות על אותו כרטיס, והדגל הפתוח יותר גובר.
    -- שמות שונים משמות עמודות ה-RETURNS TABLE בכוונה: הפניה לא מוסמכת
    -- לשם זהה הייתה עלולה להיקרא כעמודת פלט ולא כעמודת ה-CTE.
    SELECT
      bool_or(true)                      AS p_has_access,
      bool_or(sh.share_contact_details)  AS p_share_contact,
      bool_or(sh.share_medical_info)     AS p_share_medical
    FROM public.shidduchim sh
    JOIN public.students me
      ON me.user_id = auth.uid()
     AND me.deleted_at IS NULL
    WHERE sh.status <> 'draft'
      AND (
        (sh.bride_id = sid AND me.id = sh.groom_id
         AND sh.recipient_scope IN ('both', 'groom_only'))
        OR
        (sh.groom_id = sid AND me.id = sh.bride_id
         AND sh.recipient_scope IN ('both', 'bride_only'))
      )
  )
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN 'none'
      WHEN NOT EXISTS (SELECT 1 FROM target) THEN 'none'
      -- כרטיס שהנהלת המערכת לא אישרה (ממתין או נדחה): בעליו ומנהל בלבד. קודם
      -- לכל שאר הענפים, ולכן גם שדכן, איש צוות ומי שקיבל הצעה מקבלים 'none'.
      WHEN (SELECT admin_approved_at FROM target) IS NULL
        AND (SELECT user_id FROM target) IS DISTINCT FROM auth.uid()
        AND NOT COALESCE(public.is_admin(), false) THEN 'none'
      -- בעל הכרטיס, שדכן/מנהל ואיש צוות של המוסד רואים הכול ממילא,
      -- וקדימותם כאן מונעת הצרה מקרית של כרטיס שהם מורשים לו במלואו.
      WHEN (SELECT user_id FROM target) = auth.uid()
        OR COALESCE(public.is_admin(), false) THEN 'full'
      -- חדש: כרטיס בלעדי למנהל אינו במאגר - שדכן ואיש צוות רק דרך הצעה
      WHEN (SELECT admin_exclusive_at FROM target) IS NULL
        AND (public.is_shadchan_or_admin()
          OR public.staff_can_access_student(auth.uid(), sid)) THEN 'full'
      WHEN COALESCE((SELECT p_has_access FROM proposal), false) THEN 'proposal'
      ELSE 'none'
    END,
    COALESCE((SELECT p_share_contact FROM proposal), false),
    COALESCE((SELECT p_share_medical FROM proposal), false);
$function$;

-- ── 7. שער ההצעות: שדכן שאינו מנהל אינו מציע על כרטיס בלעדי ─────────────
-- אותו קוד סירוב (card_pending_approval) כמו כרטיס שלא אושר: מבחינת השדכן
-- הכרטיס אינו מאושר למאגר.
CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sides    text[];
  v_side     text;
  v_student  uuid;
  v_quota    record;
  v_pending  integer;
  v_uid      uuid := auth.uid();
  v_blocked  boolean;
  -- תוספת: מנהל (בסשן, או בעל ההצעה כשהכתיבה ב-service role) עוקף את שער
  -- אישור ההנהלה בלבד
  v_admin_bypass boolean := COALESCE(public.is_admin(), false)
                            OR COALESCE(public.is_admin(NEW.shadchan_id), false);
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status::text <> 'draft' THEN
    IF NEW.groom_id IS DISTINCT FROM OLD.groom_id
       OR NEW.bride_id IS DISTINCT FROM OLD.bride_id THEN
      RAISE EXCEPTION 'shidduch_cards_immutable' USING ERRCODE = 'P0001',
        HINT = 'לא ניתן להחליף כרטיס בהצעה שכבר אינה טיוטה';
    END IF;
    IF NEW.shadchan_id IS DISTINCT FROM OLD.shadchan_id
       AND v_uid IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'shidduch_shadchan_immutable' USING ERRCODE = 'P0001',
        HINT = 'לא ניתן להחליף שדכן בהצעה שכבר אינה טיוטה';
    END IF;
  END IF;

  -- כרטיס שהנהלת המערכת לא אישרה (ממתין או נדחה): אין הצעה חדשה עליו, גם לא
  -- טיוטה. הבדיקה כאן, לפני היציאה המוקדמת של טיוטות. (תוספת: למעט מנהל)
  IF TG_OP = 'INSERT' AND NOT v_admin_bypass THEN
    SELECT (s.admin_approved_at IS NULL OR s.admin_exclusive_at IS NOT NULL) -- חדש: גם בלעדי למנהל
      INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'groom';
    END IF;
    SELECT (s.admin_approved_at IS NULL OR s.admin_exclusive_at IS NOT NULL) -- חדש: גם בלעדי למנהל
      INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'bride';
    END IF;
  END IF;

  IF NEW.recipient_scope IS NULL OR NEW.status::text IN ('draft', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_sides := public.shidduch_gate_sides(NULL, NULL, NEW.status::text, NEW.recipient_scope);
  ELSE
    -- הורה שחוזר בו מדחייה (respond_to_shidduch): לא "קבלת הצעה" חדשה
    IF OLD.status::text = 'rejected'
       AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope
       AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
       AND v_uid IS NOT NULL
       AND v_uid IS DISTINCT FROM NEW.shadchan_id
       AND NOT public.is_admin() THEN
      RETURN NEW;
    END IF;
    v_sides := public.shidduch_gate_sides(OLD.status::text, OLD.recipient_scope, NEW.status::text, NEW.recipient_scope);
  END IF;

  -- שליחה חדשה לפחות לצד אחד: אם אחד משני הכרטיסים הוא צד שלישי שלא אושר
  -- לקבלת הצעות, כל השליחה נדחית. הצעות קיימות (בלי שליחה חדשה) לא נפגעות.
  IF cardinality(v_sides) > 0 THEN
    -- וגם שליחה של הצעה קיימת (טיוטה ישנה, או כרטיס שאישורו בוטל בינתיים)
    -- (תוספת: למעט מנהל)
    IF NOT v_admin_bypass THEN
      SELECT (s.admin_approved_at IS NULL OR s.admin_exclusive_at IS NOT NULL) -- חדש: גם בלעדי למנהל
        INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
      IF COALESCE(v_blocked, false) THEN
        RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'groom';
      END IF;
      SELECT (s.admin_approved_at IS NULL OR s.admin_exclusive_at IS NOT NULL) -- חדש: גם בלעדי למנהל
        INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
      IF COALESCE(v_blocked, false) THEN
        RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'bride';
      END IF;
    END IF;
    SELECT s.card_for = 'other' AND s.third_party_proposals_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_third_party' USING ERRCODE = 'P0001', DETAIL = 'groom';
    END IF;
    SELECT s.card_for = 'other' AND s.third_party_proposals_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.bride_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_third_party' USING ERRCODE = 'P0001', DETAIL = 'bride';
    END IF;
  END IF;

  FOREACH v_side IN ARRAY v_sides LOOP
    v_student := CASE v_side WHEN 'groom' THEN NEW.groom_id ELSE NEW.bride_id END;

    -- נעילה לכל כרטיס עד סוף הטרנזקציה: שתי שליחות מקבילות לאותו כרטיס
    -- נבדקות בזו אחר זו ולא שתיהן מול אותה ספירה (הצדדים ממוינים, ללא deadlock)
    PERFORM pg_advisory_xact_lock(hashtext('shidduch_card_gate'), hashtext(v_student::text));

    SELECT * INTO v_quota FROM public.student_proposal_quota(v_student);
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_quota.is_paused THEN
      RAISE EXCEPTION 'card_paused' USING ERRCODE = 'P0001', DETAIL = v_side;
    END IF;

    IF v_quota.limit_count IS NOT NULL THEN
      -- שליחות בשלב הראשון (sent_at ריק, עוד לא ביומן) תופסות מקום: אחרת שתי
      -- שליחות מקבילות בשני שלבים היו עוברות שתיהן את אותה ספירת יומן
      SELECT count(*)::integer INTO v_pending
        FROM public.shidduchim sh
       WHERE sh.id <> NEW.id
         AND sh.sent_at IS NULL
         AND sh.status::text NOT IN ('draft', 'rejected')
         AND v_side = ANY (public.shidduch_scope_sides(sh.recipient_scope))
         AND CASE v_side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END = v_student
         AND NOT EXISTS (
           SELECT 1 FROM public.shidduch_events e
            WHERE e.shidduch_id = sh.id AND e.student_id = v_student
         );

      IF v_quota.used_count + v_pending >= v_quota.limit_count THEN
        RAISE EXCEPTION 'proposal_limit_reached' USING ERRCODE = 'P0001', DETAIL = v_side;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.enforce_shidduch_card_gates() OWNER TO postgres;

-- ── 8. student_cards: אותו כלל, ועמודת הבלעדיות בסוף (למנהל בלבד) ───────
-- הגוף מ-20261027100000_card_countries_and_admin_focus.sql; השינוי מסומן "חדש".
CREATE OR REPLACE VIEW public.student_cards
  WITH (security_barrier = true, security_invoker = false)
  AS
  SELECT
    s.id,
    s.user_id,
    s.created_at,
    s.first_name,
    s.last_name,
    s.nickname,
    s.gender,
    s.personal_status,
    s.birth_date,
    s.height,
    s.country,
    s.city,
    s.community,
    s.shtible,
    s.cellphone_type,
    s.cv_url,
    s.in_shidduchim,
    s.status_changed_at,
    s.is_yeshiva,
    s.photo_count,
    s.institution_id,
    s.deleted_at,
    s.card_for,
    s.third_party_full_display_approved_at,
    s.third_party_proposals_approved_at,
    CASE WHEN r.is_restricted THEN NULL ELSE s.plan_for_life END AS plan_for_life,
    CASE WHEN r.is_restricted THEN NULL ELSE s.head_cover_type END AS head_cover_type,
    CASE WHEN r.is_restricted THEN NULL ELSE s.proposal_limit_count END AS proposal_limit_count,
    CASE WHEN r.is_restricted THEN NULL ELSE s.proposal_limit_period END AS proposal_limit_period,
    CASE WHEN r.is_restricted THEN NULL ELSE s.admin_paused_at END AS admin_paused_at,
    CASE WHEN r.is_restricted THEN NULL ELSE s.third_party_full_display_approved_by END
      AS third_party_full_display_approved_by,
    CASE WHEN r.is_restricted THEN NULL ELSE s.third_party_proposals_approved_by END
      AS third_party_proposals_approved_by,
    CASE WHEN r.is_restricted THEN jsonb_build_object(
      'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
      'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
    ) ELSE s.parents_info END AS parents_info,
    CASE WHEN r.is_restricted AND jsonb_typeof(s.author_info) = 'object'
         THEN s.author_info - 'fillReason'
         ELSE s.author_info END AS author_info,
    s.admin_approved_at,
    CASE WHEN (SELECT auth.uid()) = s.user_id OR (SELECT public.is_admin())
         THEN s.admin_rejected_at END AS admin_rejected_at,
    CASE WHEN (SELECT auth.uid()) = s.user_id OR (SELECT public.is_admin())
         THEN s.admin_rejection_reason END AS admin_rejection_reason,
    -- חדש: כהן (פרט בסיסי, כמו הסטטוס האישי) ומוכן/ה לגור ב
    s.is_kohen,
    CASE WHEN r.is_restricted THEN NULL ELSE s.willing_to_live_countries END
      AS willing_to_live_countries,
    -- חדש: סימון "במיקוד" של ההנהלה - לשדכן ולמנהל בלבד (לא לבעל הכרטיס)
    CASE WHEN (SELECT public.is_shadchan_or_admin()) THEN f.focused_at END
      AS admin_focus_at,
    CASE WHEN (SELECT public.is_shadchan_or_admin()) THEN f.note END
      AS admin_focus_note,
    -- חדש: אישור בלעדי למנהל - למנהל בלבד. בעל הכרטיס רואה "מאושר"
    CASE WHEN (SELECT public.is_admin()) THEN s.admin_exclusive_at END
      AS admin_exclusive_at
  FROM public.students s
  CROSS JOIN LATERAL (
    SELECT (
      s.card_for = 'other'
      AND s.third_party_full_display_approved_at IS NULL
      AND public.student_display_restricted(s.id)
    ) IS TRUE AS is_restricted
  ) r
  LEFT JOIN public.student_admin_focus f ON f.student_id = s.id
  WHERE s.deleted_at IS NULL
    AND (
      (SELECT auth.uid()) = s.user_id
      OR (SELECT public.is_shadchan_or_admin())
      OR public.staff_can_access_student((SELECT auth.uid()), s.id)
    )
    -- כרטיס שהנהלת המערכת לא אישרה, או אישרה להצעות המנהל בלבד (חדש):
    -- בעליו ומנהל בלבד
    AND (
      (s.admin_approved_at IS NOT NULL AND s.admin_exclusive_at IS NULL)
      OR (SELECT auth.uid()) = s.user_id
      OR (SELECT public.is_admin())
    );

ALTER VIEW public.student_cards OWNER TO postgres;
REVOKE ALL ON public.student_cards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.student_cards TO authenticated;

-- ── 9. ההתראה לבעל הכרטיס על האישור: בלי "מוצג לשדכנים" באישור בלעדי ─────
CREATE OR REPLACE FUNCTION public.notify_owner_card_reviewed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_approved_at IS NOT NULL AND OLD.admin_approved_at IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      NEW.user_id,
      'card_approved',
      'הכרטיס אושר',
      'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
        -- חדש: אישור בלעדי למנהל - הכרטיס אינו מוצג במאגר
        || CASE WHEN NEW.admin_exclusive_at IS NOT NULL
                THEN ' אושר על ידי הנהלת המערכת.'
                ELSE ' אושר על ידי הנהלת המערכת, ומעכשיו הוא מוצג לשדכנים.' END,
      '/app/students/' || NEW.id,
      NEW.id
    );
  -- חדש: דחייה שקטה - בלי התראה לבעל הכרטיס
  ELSIF NEW.admin_rejected_at IS NOT NULL AND OLD.admin_rejected_at IS NULL
        AND NOT NEW.admin_review_silent THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      NEW.user_id,
      'card_rejected',
      'הכרטיס לא אושר',
      'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
        || ' לא אושר על ידי הנהלת המערכת. אפשר לתקן את הכרטיס ולשלוח אותו'
        || ' לאישור מחדש. הסיבה שצוינה: ' || COALESCE(NEW.admin_rejection_reason, ''),
      '/app/students/' || NEW.id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_owner_card_reviewed() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_owner_card_reviewed() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח רק כשהקוד שקורא את admin_exclusive_at אינו באוויר. כרטיס בלעדי הופך
-- למאושר רגיל (מוצג במאגר) - לשקול קודם להחזיר אותו להמתנה.
--   -- להחיל מחדש: enforce_student_admin_approval_lock (20261019090000) והטריגר
--   -- שלה, enforce_unapproved_card_writes, המדיניות "Unapproved cards..." על
--   -- students, get_student_card_access (20261019100000), student_hidden_until_approved
--   -- (20261019090000), enforce_shidduch_card_gates (20261028100000),
--   -- notify_owner_card_reviewed (20261027130000), ואז:
--   DROP VIEW IF EXISTS public.student_cards;
--   -- ...ולהריץ שוב את החלק של student_cards מ-20261027100000_card_countries_and_admin_focus.sql
--   ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_admin_exclusive_state_check;
--   ALTER TABLE public.students
--     DROP COLUMN IF EXISTS admin_exclusive_by,
--     DROP COLUMN IF EXISTS admin_exclusive_at;
--   NOTIFY pgrst, 'reload schema';
