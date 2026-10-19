-- מנהל מערכת רשאי ליצור ולשלוח הצעה גם על כרטיס שהנהלת המערכת עוד לא אישרה
-- (ממתין או נדחה). שדכן שאינו מנהל - חסום כמו קודם.
--
-- מה משתנה: בדיקות card_pending_approval ב-enforce_shidduch_card_gates מדולגות
-- כשהמבצע מנהל (is_admin() בסשן שלו) או כשההצעה שייכת למנהל (shadchan_id).
-- התנאי השני נדרש כי ה-routes כותבים ב-service role (auth.uid() ריק), והם
-- קובעים shadchan_id = המשתמש המחובר; שדכן אינו יכול לרשום הצעה על שם מנהל
-- (RLS: auth.uid() = shadchan_id). שער צד שלישי, השהיה ומכסה - בלי שינוי, גם
-- למנהל.
-- גוף הפונקציה הועתק מההגדרה הקיימת במסד; התוספת מסומנת בהערה.
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

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
    SELECT s.admin_approved_at IS NULL
      INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
    IF COALESCE(v_blocked, false) THEN
      RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'groom';
    END IF;
    SELECT s.admin_approved_at IS NULL
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
      SELECT s.admin_approved_at IS NULL
        INTO v_blocked FROM public.students s WHERE s.id = NEW.groom_id;
      IF COALESCE(v_blocked, false) THEN
        RAISE EXCEPTION 'card_pending_approval' USING ERRCODE = 'P0001', DETAIL = 'groom';
      END IF;
      SELECT s.admin_approved_at IS NULL
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

-- ── rollback ─────────────────────────────────────────────────────────
-- להחיל מחדש את enforce_shidduch_card_gates מ-20261019100000_card_admin_approval_gate.sql
