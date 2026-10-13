-- דיווח על כרטיס (פריט 26): כל משתמש מחובר שרואה כרטיס ואינו בעליו יכול לדווח
-- עליו למנהל. הכתיבה רק דרך report_student_card (SECURITY DEFINER); קריאה
-- ועדכון ("סומן כטופל") למנהל בלבד. אידמפוטנטי.

-- ---------------------------------------------------------------------------
-- 1. הטבלה
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  details     text,
  status      text NOT NULL DEFAULT 'open',
  handled_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT card_reports_reason_check CHECK (
    reason IN ('wrong_details', 'duplicate_card', 'inappropriate_content',
               'no_longer_available', 'other')
  ),
  CONSTRAINT card_reports_details_length_check CHECK (
    details IS NULL OR char_length(details) <= 1000
  ),
  CONSTRAINT card_reports_other_needs_details_check CHECK (
    reason <> 'other' OR char_length(btrim(coalesce(details, ''))) > 0
  ),
  CONSTRAINT card_reports_status_check CHECK (status IN ('open', 'handled'))
);

COMMENT ON TABLE public.card_reports IS
  'דיווחי משתמשים על כרטיסים. נכתבת רק דרך report_student_card; מנהל בלבד קורא ומטפל';

-- דיווח פתוח אחד לכל מדווח בכל כרטיס
CREATE UNIQUE INDEX IF NOT EXISTS card_reports_one_open_per_reporter
  ON public.card_reports (student_id, reporter_id) WHERE status = 'open';
-- רשימת המנהל: לפי סטטוס, החדש ראשון
CREATE INDEX IF NOT EXISTS idx_card_reports_status_created
  ON public.card_reports (status, created_at DESC);
-- מכסה יומית למדווח + מפתחות זרים
CREATE INDEX IF NOT EXISTS idx_card_reports_reporter_created
  ON public.card_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_reports_handled_by
  ON public.card_reports (handled_by) WHERE handled_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. RLS: מנהל קורא ומעדכן; אין גישה ישירה לאחרים ואין INSERT ישיר
-- ---------------------------------------------------------------------------
ALTER TABLE public.card_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card_reports select admin" ON public.card_reports;
CREATE POLICY "Card_reports select admin" ON public.card_reports
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Card_reports update admin" ON public.card_reports;
CREATE POLICY "Card_reports update admin" ON public.card_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.card_reports FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.card_reports FROM authenticated;
GRANT SELECT ON TABLE public.card_reports TO authenticated;
GRANT UPDATE (status, handled_by, handled_at)
  ON TABLE public.card_reports TO authenticated;
GRANT ALL ON TABLE public.card_reports TO service_role;

-- ---------------------------------------------------------------------------
-- 3. דיווח: בדיקות + הכנסה + התראה לכל המנהלים
--    מחזירה קוד סטטוס יציב (טקסט) שהנתיב ממפה להודעות קבועות
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_student_card(
  p_student_id uuid,
  p_reason text,
  p_details text
) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_details text := NULLIF(btrim(coalesce(p_details, '')), '');
  v_level text;
  v_owner uuid;
  v_name text;
  v_report_id uuid;
  v_reason_label text;
  c_daily_limit CONSTANT integer := 10;
  c_max_details CONSTANT integer := 1000;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'authentication_required';
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN (
    'wrong_details', 'duplicate_card', 'inappropriate_content',
    'no_longer_available', 'other'
  ) THEN
    RETURN 'invalid_reason';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > c_max_details THEN
    RETURN 'details_too_long';
  END IF;
  IF p_reason = 'other' AND v_details IS NULL THEN
    RETURN 'details_required';
  END IF;

  -- אותה הכרעת חשיפה כמו בדף הכרטיס: מי שאינו רואה את הכרטיס לא מדווח עליו
  SELECT a.access_level INTO v_level
  FROM public.get_student_card_access(p_student_id) a;
  IF v_level IS NULL OR v_level = 'none' THEN
    RETURN 'card_not_visible';
  END IF;

  SELECT s.user_id, btrim(s.first_name || ' ' || s.last_name)
    INTO v_owner, v_name
  FROM public.students s
  WHERE s.id = p_student_id AND s.deleted_at IS NULL;
  IF v_owner IS NOT DISTINCT FROM v_uid THEN
    RETURN 'own_card';
  END IF;

  IF (SELECT count(*) FROM public.card_reports r
      WHERE r.reporter_id = v_uid
        AND r.created_at > now() - interval '24 hours') >= c_daily_limit THEN
    RETURN 'daily_limit_reached';
  END IF;

  BEGIN
    INSERT INTO public.card_reports (student_id, reporter_id, reason, details)
    VALUES (p_student_id, v_uid, p_reason, v_details)
    RETURNING id INTO v_report_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already_reported';
  END;

  v_reason_label := CASE p_reason
    WHEN 'wrong_details' THEN 'פרטים שגויים'
    WHEN 'duplicate_card' THEN 'כרטיס כפול'
    WHEN 'inappropriate_content' THEN 'תוכן לא הולם'
    WHEN 'no_longer_available' THEN 'המיועד/ת כבר לא בשידוכים'
    ELSE 'אחר'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'card_report',
    'דיווח חדש על כרטיס',
    'דווח על הכרטיס של ' || coalesce(v_name, 'מיועד') || ': ' || v_reason_label || '.',
    '/app/admin/card-reports',
    v_report_id
  FROM auth.users u
  WHERE u.raw_app_meta_data->'roles' ? 'admin';

  RETURN 'created';
END;
$function$;

ALTER FUNCTION public.report_student_card(uuid, text, text) OWNER TO postgres;
COMMENT ON FUNCTION public.report_student_card(uuid, text, text) IS
  'דיווח על כרטיס. קורא את המדווח מ-auth.uid(). קודי תשובה: created / authentication_required / invalid_reason / details_required / details_too_long / card_not_visible / own_card / daily_limit_reached / already_reported';

REVOKE ALL ON FUNCTION public.report_student_card(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_student_card(uuid, text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK (ידני):
--   DROP FUNCTION IF EXISTS public.report_student_card(uuid, text, text);
--   DROP TABLE IF EXISTS public.card_reports;
--   (סוג ההתראה card_report נשאר ב-notifications_type_check מהמיגרציה הקודמת;
--    שורות התראה קיימות מסוגו: DELETE FROM public.notifications WHERE type = 'card_report';)
-- ---------------------------------------------------------------------------
