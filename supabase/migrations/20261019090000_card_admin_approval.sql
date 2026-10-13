-- אישור הנהלה לכל כרטיס חדש, שלב 1 מתוך 2 (תוספת בלבד, בטוח להחיל לפני הקוד).
--
-- כאן: מצב האישור על students, כל הכרטיסים הקיימים מאושרים, נעילה (רק מנהל /
-- service role משנה אישור), התראות, ועמודות הסטטוס ב-student_cards.
-- מה שלא משתנה בשלב הזה: כרטיס חדש ממשיך להיווצר מאושר (ברירת המחדל של
-- admin_approved_at היא now()) ונראה לשדכנים כמו היום. המעבר ל"כרטיס חדש
-- ממתין לאישור" וחסימת הנראות נמצאים בשלב 2
-- (20261019100000_card_admin_approval_gate.sql), שמוחל רק אחרי שהקוד עלה.
--
-- מצב כרטיס (שלושה, מוכרעים משתי עמודות):
--   מאושר  - admin_approved_at אינו ריק
--   נדחה   - admin_rejected_at אינו ריק (עם סיבה)
--   ממתין  - שתיהן ריקות. ערך ריק או לא ידוע = לא מאושר (סגור כברירת מחדל).
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. עמודות המצב + כל הכרטיסים הקיימים מאושרים ────────────────────────
DO $migration$
DECLARE
  v_already_applied boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students'
      AND column_name = 'admin_approved_at'
  ) INTO v_already_applied;

  ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS admin_approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS admin_approved_by uuid
      REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS admin_rejected_at timestamptz,
    ADD COLUMN IF NOT EXISTS admin_rejected_by uuid
      REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS admin_rejection_reason text;

  -- רק בריצה הראשונה: כל כרטיס קיים (גם כזה שנמחק, כדי ששחזור לא ייצור כרטיס
  -- ממתין) מאושר מרגע היצירה שלו. כך "חדש היום/השבוע", שמעכשיו נמדד מרגע
  -- האישור, נשאר זהה לכרטיסים הקיימים.
  IF NOT v_already_applied THEN
    UPDATE public.students
       SET admin_approved_at = COALESCE(created_at, now());
    -- עד שלב 2 כרטיס חדש נוצר מאושר, בדיוק כמו היום
    ALTER TABLE public.students
      ALTER COLUMN admin_approved_at SET DEFAULT now();
  END IF;
END
$migration$;

COMMENT ON COLUMN public.students.admin_approved_at IS
  'מתי הנהלת המערכת אישרה את הכרטיס (null = לא מאושר: ממתין או נדחה). עד האישור הכרטיס גלוי לבעליו ולמנהלים בלבד';
COMMENT ON COLUMN public.students.admin_rejected_at IS
  'מתי הנהלת המערכת דחתה את הכרטיס (null = לא נדחה)';
COMMENT ON COLUMN public.students.admin_rejection_reason IS
  'סיבת הדחייה שהמנהל כתב לבעל הכרטיס. לבעלים ולמנהלים בלבד';

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_admin_approval_state_check;
ALTER TABLE public.students
  ADD CONSTRAINT students_admin_approval_state_check CHECK (
    -- לא מאושר ונדחה בו בזמן
    NOT (admin_approved_at IS NOT NULL AND admin_rejected_at IS NOT NULL)
    -- סיבה קיימת בדיוק כשהכרטיס נדחה, ואינה ריקה
    AND (admin_rejected_at IS NULL) = (admin_rejection_reason IS NULL)
    AND (admin_rejection_reason IS NULL OR btrim(admin_rejection_reason) <> '')
  );

-- התור של המנהל: כרטיסים שאינם מאושרים, מהחדש לישן
CREATE INDEX IF NOT EXISTS students_admin_unapproved_idx
  ON public.students (created_at DESC)
  WHERE admin_approved_at IS NULL AND deleted_at IS NULL;
-- "חדשים" ומיון לפי תאריך הוספה ברשימת השדכנים: לפי רגע האישור
CREATE INDEX IF NOT EXISTS students_admin_approved_at_idx
  ON public.students (admin_approved_at DESC)
  WHERE deleted_at IS NULL;

-- ── 2. נעילה: רק מנהל / service role קובע אישור ──────────────────────────
-- ביצירה (פעיל רק משלב 2, שמוסיף את INSERT לטריגר):
--   מנהל שיוצר כרטיס - מאושר מיד; service role - כפי שנשלח (ריק = ממתין);
--   כל משתמש אחר - ממתין, בלי קשר למה שנשלח.
-- בעדכון: מי שאינו מנהל / service role אינו משנה את עמודות האישור. החריג
--   היחיד: בעל כרטיס שנדחה מחזיר אותו לממתין (שליחה לאישור מחדש).
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
    RETURN NEW;
  END IF;

  v_changed :=
    NEW.admin_approved_at IS DISTINCT FROM OLD.admin_approved_at
    OR NEW.admin_approved_by IS DISTINCT FROM OLD.admin_approved_by
    OR NEW.admin_rejected_at IS DISTINCT FROM OLD.admin_rejected_at
    OR NEW.admin_rejected_by IS DISTINCT FROM OLD.admin_rejected_by
    OR NEW.admin_rejection_reason IS DISTINCT FROM OLD.admin_rejection_reason;

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
     AND NEW.admin_rejection_reason IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'student_approval_forbidden' USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.enforce_student_admin_approval_lock() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_student_admin_approval_lock() FROM PUBLIC, anon, authenticated;

-- נוצר רק אם אינו קיים: שלב 2 מחליף אותו בטריגר שפועל גם ביצירה, והרצה חוזרת
-- של הקובץ הזה אחרי שלב 2 אינה מחזירה אותו לאחור.
DO $lock_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.students'::regclass
      AND tgname = 'trigger_enforce_student_admin_approval_lock'
  ) THEN
    CREATE TRIGGER trigger_enforce_student_admin_approval_lock
      BEFORE UPDATE OF admin_approved_at, admin_approved_by,
        admin_rejected_at, admin_rejected_by, admin_rejection_reason
      ON public.students
      FOR EACH ROW EXECUTE FUNCTION public.enforce_student_admin_approval_lock();
  END IF;
END
$lock_trigger$;

-- ── 3. הכלל, לשימוש במדיניות ובפונקציות של שלב 2 ────────────────────────
-- true: הכרטיס אינו מאושר, והצופה אינו בעל הכרטיס ואינו מנהל (וגם כשהכרטיס
-- אינו קיים - סגור כברירת מחדל).
CREATE OR REPLACE FUNCTION public.student_hidden_until_approved(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT s.admin_approved_at IS NULL
       AND s.user_id IS DISTINCT FROM auth.uid()
       AND NOT COALESCE(public.is_admin(), false)
      FROM public.students s
     WHERE s.id = p_student_id
  ), true);
$$;

ALTER FUNCTION public.student_hidden_until_approved(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.student_hidden_until_approved(uuid) IS
  'האם הכרטיס חבוי מהצופה הנוכחי כי הנהלת המערכת עוד לא אישרה אותו (בעלים ומנהל רואים תמיד)';
REVOKE ALL ON FUNCTION public.student_hidden_until_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_hidden_until_approved(uuid) TO authenticated, service_role;

-- ── 4. student_cards: שלוש עמודות סטטוס בסוף ────────────────────────────
-- admin_approved_at נחוץ לרשימה ("חדש" ומיון לפי תאריך הוספה). הדחייה והסיבה
-- שלה חוזרות רק לבעל הכרטיס ולמנהל. תנאי הנראות עצמו אינו משתנה בשלב הזה.
-- מוחלף רק כשהעמודות עוד אינן ב-view: שלב 2 מוסיף לו את תנאי הנראות, והרצה
-- חוזרת של הקובץ הזה אחרי שלב 2 אינה מסירה אותו.
DO $cards_view$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_cards'
      AND column_name = 'admin_approved_at'
  ) THEN
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
             THEN s.admin_rejection_reason END AS admin_rejection_reason
      FROM public.students s
      CROSS JOIN LATERAL (
        SELECT (
          s.card_for = 'other'
          AND s.third_party_full_display_approved_at IS NULL
          AND public.student_display_restricted(s.id)
        ) IS TRUE AS is_restricted
      ) r
      WHERE s.deleted_at IS NULL
        AND (
          (SELECT auth.uid()) = s.user_id
          OR (SELECT public.is_shadchan_or_admin())
          OR public.staff_can_access_student((SELECT auth.uid()), s.id)
        );
  END IF;
END
$cards_view$;

ALTER VIEW public.student_cards OWNER TO postgres;
REVOKE ALL ON public.student_cards FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.student_cards TO authenticated;

-- ── 5. התראות ────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
    'shidduch_offer'::text,
    'shidduch_response'::text,
    'application_reviewed'::text,
    'application_submitted'::text,
    'chat_message'::text,
    'photo_request_submitted'::text,
    'photo_request_reviewed'::text,
    'user_registered'::text,
    'shidduch_closed_notice'::text,
    'third_party_card_created'::text,
    'third_party_card_approved'::text,
    'application_message'::text,
    'card_report'::text,
    'card_pending_approval'::text,
    'card_approved'::text,
    'card_rejected'::text
  ]));

-- כרטיס שממתין לאישור -> כל המנהלים. התראה אחת לכל כרטיס חדש: כרטיס צד שלישי
-- חדש כבר שולח third_party_card_created (notify_admins_third_party_card),
-- ולכן ביצירה הוא אינו שולח גם את זו. שליחה לאישור מחדש שולחת לכל סוגי הכרטיס.
CREATE OR REPLACE FUNCTION public.notify_admins_card_pending_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_is_resubmission boolean := false;
BEGIN
  IF NEW.admin_approved_at IS NOT NULL OR NEW.admin_rejected_at IS NOT NULL
     OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.card_for IS NOT DISTINCT FROM 'other' THEN
      RETURN NEW;
    END IF;
  ELSE
    v_is_resubmission := OLD.admin_rejected_at IS NOT NULL;
    IF NOT v_is_resubmission THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'card_pending_approval',
    CASE WHEN v_is_resubmission
         THEN 'כרטיס נשלח לאישור מחדש'
         ELSE 'כרטיס חדש ממתין לאישור' END,
    'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
      || CASE WHEN v_is_resubmission
              THEN ' תוקן ונשלח שוב לאישור הנהלת המערכת.'
              ELSE ' ממתין לאישור הנהלת המערכת.' END,
    '/app/admin/new-cards',
    NEW.id
  FROM auth.users u
  WHERE public.has_role(u.id, 'admin');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_card_pending_approval() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_admins_card_pending_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_notify_admins_card_pending_approval ON public.students;
CREATE TRIGGER trigger_notify_admins_card_pending_approval
  AFTER INSERT OR UPDATE OF admin_rejected_at ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_card_pending_approval();

-- אישור או דחייה -> בעל הכרטיס (לא כשהוא עצמו המנהל שהכריע)
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
        || ' אושר על ידי הנהלת המערכת, ומעכשיו הוא מוצג לשדכנים.',
      '/app/students/' || NEW.id,
      NEW.id
    );
  ELSIF NEW.admin_rejected_at IS NOT NULL AND OLD.admin_rejected_at IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      NEW.user_id,
      'card_rejected',
      'הכרטיס לא אושר',
      'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
        || ' לא אושר על ידי הנהלת המערכת. אפשר לתקן את הכרטיס ולשלוח אותו'
        || ' לאישור מחדש. הסיבה שצוינה: ' || NEW.admin_rejection_reason,
      '/app/students/' || NEW.id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_owner_card_reviewed() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_owner_card_reviewed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_notify_owner_card_reviewed ON public.students;
CREATE TRIGGER trigger_notify_owner_card_reviewed
  AFTER UPDATE OF admin_approved_at, admin_rejected_at ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_card_reviewed();

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- בטוח רק כשהקוד שקורא את עמודות האישור אינו באוויר, ואחרי rollback של שלב 2.
-- מוחק את מצב האישור של כל הכרטיסים (העמודות נמחקות).
--
--   DROP TRIGGER IF EXISTS trigger_notify_owner_card_reviewed ON public.students;
--   DROP TRIGGER IF EXISTS trigger_notify_admins_card_pending_approval ON public.students;
--   DROP TRIGGER IF EXISTS trigger_enforce_student_admin_approval_lock ON public.students;
--   DROP FUNCTION IF EXISTS public.notify_owner_card_reviewed();
--   DROP FUNCTION IF EXISTS public.notify_admins_card_pending_approval();
--   DROP FUNCTION IF EXISTS public.enforce_student_admin_approval_lock();
--   -- ה-view חוזר להגדרה של 20261016090000_student_cards_view.sql (יש למחוק
--   -- וליצור מחדש: אי אפשר להסיר עמודות ב-CREATE OR REPLACE):
--   DROP VIEW IF EXISTS public.student_cards;
--   -- ...ואז להריץ שוב את 20261016090000_student_cards_view.sql
--   DROP FUNCTION IF EXISTS public.student_hidden_until_approved(uuid);
--   DELETE FROM public.notifications
--     WHERE type IN ('card_pending_approval', 'card_approved', 'card_rejected');
--   -- ...ואז להריץ שוב את 20261018090000_notification_types_application_message_card_report.sql
--   DROP INDEX IF EXISTS public.students_admin_approved_at_idx;
--   DROP INDEX IF EXISTS public.students_admin_unapproved_idx;
--   ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_admin_approval_state_check;
--   ALTER TABLE public.students
--     DROP COLUMN IF EXISTS admin_rejection_reason,
--     DROP COLUMN IF EXISTS admin_rejected_by,
--     DROP COLUMN IF EXISTS admin_rejected_at,
--     DROP COLUMN IF EXISTS admin_approved_by,
--     DROP COLUMN IF EXISTS admin_approved_at;
--   NOTIFY pgrst, 'reload schema';
