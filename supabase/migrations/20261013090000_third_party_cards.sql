-- כרטיסים שמולאו על ידי צד שלישי (students.card_for = 'other'):
--  1. שני אישורי הנהלה בלתי תלויים, על הכרטיס: הצגת נתונים מלאים, ואפשרות
--     לקבל הצעות. נכתבים רק על ידי מנהל / service role (כמו admin_paused_*).
--  2. כרטיס שקיים ברגע המיגרציה מקבל את שני האישורים ("מי שקיים נשאר כך").
--  3. עד שהוצג-מלא אושר, שדכנים וצדדים אחרים אינם רואים את הטבלאות הרגישות
--     (previous_partners, references, partner_preferences, medical_records);
--     בעלי הכרטיס ומנהלים רואים הכול. העמודות הרגישות של students עצמה
--     (about, family_info, parents_info) נחסמות בשכבת האפליקציה, ובעמודה
--     המחושבת parents_info_for_viewer.
--  4. שער ההצעות (enforce_shidduch_card_gates) מסרב לכרטיס צד שלישי שלא אושר.
--  5. התראות: למנהלים על כרטיס צד שלישי חדש, ולממלא על אישור.
-- אידמפוטנטית.

-- ── 1. עמודות האישור + הענקת אישור לכרטיסים הקיימים ────────────────────
DO $migration$
DECLARE
  v_already_applied boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students'
      AND column_name = 'third_party_full_display_approved_at'
  ) INTO v_already_applied;

  ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS third_party_full_display_approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS third_party_full_display_approved_by uuid
      REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS third_party_proposals_approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS third_party_proposals_approved_by uuid
      REFERENCES auth.users(id) ON DELETE SET NULL;

  -- רק בריצה הראשונה: כרטיס צד שלישי שכבר קיים ממשיך להיראות ולקבל הצעות
  -- בדיוק כפי שהיה. כרטיס שייווצר אחרי המיגרציה מתחיל לא מאושר.
  IF NOT v_already_applied THEN
    UPDATE public.students
       SET third_party_full_display_approved_at = now(),
           third_party_proposals_approved_at = now()
     WHERE card_for = 'other';
  END IF;
END
$migration$;

COMMENT ON COLUMN public.students.third_party_full_display_approved_at IS
  'כרטיס צד שלישי: מתי המנהל אישר הצגת נתונים מלאים (null = רק נתונים בסיסיים)';
COMMENT ON COLUMN public.students.third_party_proposals_approved_at IS
  'כרטיס צד שלישי: מתי המנהל אישר קבלת הצעות (null = אין הצעות)';

CREATE INDEX IF NOT EXISTS students_third_party_idx
  ON public.students (created_at DESC)
  WHERE card_for = 'other' AND deleted_at IS NULL;

-- ── 2. נעילה: רק מנהל / service role משנה אישורים ──────────────────────
-- ושינוי של כרטיס אל 'other' מאפס אישורים ישנים (מתחיל לא מאושר).
CREATE OR REPLACE FUNCTION public.enforce_third_party_approval_lock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_trusted boolean := auth.uid() IS NULL OR public.is_admin();
  v_approvals_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_approvals_changed :=
      NEW.third_party_full_display_approved_at IS NOT NULL
      OR NEW.third_party_full_display_approved_by IS NOT NULL
      OR NEW.third_party_proposals_approved_at IS NOT NULL
      OR NEW.third_party_proposals_approved_by IS NOT NULL;
  ELSE
    v_approvals_changed :=
      NEW.third_party_full_display_approved_at IS DISTINCT FROM OLD.third_party_full_display_approved_at
      OR NEW.third_party_full_display_approved_by IS DISTINCT FROM OLD.third_party_full_display_approved_by
      OR NEW.third_party_proposals_approved_at IS DISTINCT FROM OLD.third_party_proposals_approved_at
      OR NEW.third_party_proposals_approved_by IS DISTINCT FROM OLD.third_party_proposals_approved_by;
  END IF;

  IF v_approvals_changed AND NOT v_is_trusted THEN
    RAISE EXCEPTION 'third_party_approval_forbidden' USING ERRCODE = '42501';
  END IF;

  -- עבר ל-'other' עכשיו: האישורים של פעם קודמת לא חלים
  IF TG_OP = 'UPDATE' AND NOT v_approvals_changed
     AND NEW.card_for = 'other' AND OLD.card_for IS DISTINCT FROM 'other' THEN
    NEW.third_party_full_display_approved_at := NULL;
    NEW.third_party_full_display_approved_by := NULL;
    NEW.third_party_proposals_approved_at := NULL;
    NEW.third_party_proposals_approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_third_party_approval_lock() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_enforce_third_party_approval_lock ON public.students;
CREATE TRIGGER trigger_enforce_third_party_approval_lock
  BEFORE INSERT OR UPDATE OF card_for,
    third_party_full_display_approved_at, third_party_full_display_approved_by,
    third_party_proposals_approved_at, third_party_proposals_approved_by
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_third_party_approval_lock();

-- ── 3. הצגה מוגבלת: כרטיס צד שלישי שלא אושר, לצופה שאינו בעלים או מנהל ──
CREATE OR REPLACE FUNCTION public.student_display_restricted(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT s.card_for = 'other'
       AND s.third_party_full_display_approved_at IS NULL
       AND s.user_id IS DISTINCT FROM auth.uid()
       AND NOT public.is_admin()
      FROM public.students s
     WHERE s.id = p_student_id
  ), false);
$$;

ALTER FUNCTION public.student_display_restricted(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.student_display_restricted(uuid) IS
  'האם הצופה הנוכחי מוגבל לנתונים בסיסיים בכרטיס (צד שלישי שלא אושר להצגה מלאה)';

-- עמודה מחושבת (PostgREST): parents_info במלואו, ובכרטיס מוגבל - שמות ההורים בלבד
CREATE OR REPLACE FUNCTION public.parents_info_for_viewer(s public.students) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN public.student_display_restricted(s.id) THEN jsonb_build_object(
      'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
      'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
    )
    ELSE s.parents_info
  END;
$$;

ALTER FUNCTION public.parents_info_for_viewer(public.students) OWNER TO postgres;

-- הטבלאות הרגישות: שדכן / צד שקיבל הצעה אינם רואים אותן בכרטיס מוגבל.
-- הבעלים נשאר בתנאי נפרד, ומנהל אינו מוגבל (הפונקציה מחזירה false).
DO $policies$
DECLARE
  v_table text;
  v_reveal text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['previous_partners', 'references', 'partner_preferences', 'medical_records'] LOOP
    v_reveal := CASE WHEN v_table = 'medical_records'
      THEN 'public.shidduch_reveals_medical(auth.uid(), student_id)'
      ELSE 'public.shidduch_reveals_student(auth.uid(), student_id)'
    END;
    EXECUTE format('DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.%I', v_table);
    EXECUTE format($f$
      CREATE POLICY "Users read own students or shadchanim see all" ON public.%1$I
        FOR SELECT
        USING (
          (
            (public.is_shadchan_or_admin() OR %2$s)
            AND NOT public.student_display_restricted(student_id)
          )
          OR EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = %1$I.student_id AND s.user_id = auth.uid()
          )
        )
    $f$, v_table, v_reveal);
  END LOOP;
END
$policies$;

-- ── 4. שער ההצעות: כרטיס צד שלישי שלא אושר לקבלת הצעות ──────────────────
-- הגוף הועתק מ-20261007110000_security_hardening_2.sql (ההגדרה האחרונה);
-- התוספת היחידה: הבדיקה של card_third_party, לפני שער המכסה וההשהיה.
-- שליחה לצד אחד נדחית גם כשהכרטיס של הצד השני הוא זה שלא אושר.
CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sides    text[];
  v_side     text;
  v_student  uuid;
  v_quota    record;
  v_pending  integer;
  v_uid      uuid := auth.uid();
  v_blocked  boolean;
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
$$;

ALTER FUNCTION public.enforce_shidduch_card_gates() OWNER TO postgres;

-- ── 5. התראות ────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'shidduch_offer',
    'shidduch_response',
    'application_reviewed',
    'application_submitted',
    'chat_message',
    'photo_request_submitted',
    'photo_request_reviewed',
    'user_registered',
    'shidduch_closed_notice',
    'third_party_card_created',
    'third_party_card_approved'
  ));

-- כרטיס צד שלישי חדש (או כרטיס שהפך לכזה) -> כל המנהלים
CREATE OR REPLACE FUNCTION public.notify_admins_third_party_card() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF NEW.card_for IS DISTINCT FROM 'other' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.card_for IS NOT DISTINCT FROM 'other' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'third_party_card_created',
    'כרטיס חדש שמולא על ידי צד שלישי',
    'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
      || ' ממתין לאישור הצגה מלאה ושליחת הצעות.',
    '/app/admin/third-party-cards',
    NEW.id
  FROM auth.users u
  WHERE public.has_role(u.id, 'admin');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_third_party_card() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_admins_third_party_card ON public.students;
CREATE TRIGGER trigger_notify_admins_third_party_card
  AFTER INSERT OR UPDATE OF card_for ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_third_party_card();

-- אישור שניתן -> מנהל הכרטיס (הממלא)
CREATE OR REPLACE FUNCTION public.notify_third_party_card_approved() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_what text;
BEGIN
  IF NEW.card_for IS DISTINCT FROM 'other' THEN
    RETURN NEW;
  END IF;

  v_what := concat_ws(' ו',
    CASE WHEN NEW.third_party_full_display_approved_at IS NOT NULL
          AND OLD.third_party_full_display_approved_at IS NULL
         THEN 'הצגת הנתונים המלאים' END,
    CASE WHEN NEW.third_party_proposals_approved_at IS NOT NULL
          AND OLD.third_party_proposals_approved_at IS NULL
         THEN 'קבלת הצעות' END
  );
  IF v_what = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  VALUES (
    NEW.user_id,
    'third_party_card_approved',
    'הנהלת המערכת אישרה את הכרטיס',
    'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name || ': אושרה ' || v_what || '.',
    '/app/students/' || NEW.id,
    NEW.id
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_third_party_card_approved() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_third_party_card_approved ON public.students;
CREATE TRIGGER trigger_notify_third_party_card_approved
  AFTER UPDATE OF third_party_full_display_approved_at, third_party_proposals_approved_at
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.notify_third_party_card_approved();

NOTIFY pgrst, 'reload schema';
