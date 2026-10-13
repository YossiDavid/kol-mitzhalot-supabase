-- הודעות חופשיות ממנהל למבקש/ת הצטרפות (שדכן / איש צוות).
--  * חד-כיווני: מנהל -> מבקש. אין תשובות מהמבקש.
--  * הכתיבה רק מה-route בשרת (service_role); משתמשים רגילים ומנהלים דרך
--    הדפדפן לא כותבים ישירות: אין הרשאות INSERT/UPDATE/DELETE ל-authenticated.
--  * קריאה: מנהל רואה הכול, מבקש/ת רואה רק את ההודעות שלו/ה.
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

CREATE TABLE IF NOT EXISTS public.application_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_kind      text        NOT NULL,
  applicant_user_id uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  admin_id          uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body              text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_messages_kind_check
    CHECK (request_kind IN ('shadchan', 'staff')),
  CONSTRAINT application_messages_body_length_check
    CHECK (char_length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS application_messages_applicant_created_idx
  ON public.application_messages (applicant_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS application_messages_kind_applicant_idx
  ON public.application_messages (request_kind, applicant_user_id);

-- אינדקס לכיסוי ה-FK של admin_id (מחיקת מנהל)
CREATE INDEX IF NOT EXISTS application_messages_admin_idx
  ON public.application_messages (admin_id);

ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_messages_admin_select ON public.application_messages;
CREATE POLICY application_messages_admin_select
  ON public.application_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS application_messages_applicant_select ON public.application_messages;
CREATE POLICY application_messages_applicant_select
  ON public.application_messages
  FOR SELECT TO authenticated
  USING (applicant_user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.application_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.application_messages TO authenticated;
GRANT ALL ON TABLE public.application_messages TO service_role;

COMMENT ON TABLE public.application_messages IS
  'הודעות חופשיות ממנהל למבקש/ת הצטרפות כשדכן או איש צוות. כתיבה רק ע"י service_role (route בשרת).';

-- ── Rollback (להריץ ידנית) ──
-- DROP TABLE IF EXISTS public.application_messages;
-- (ההתראות מסוג application_message נשארות; ראו את ה-rollback של 20261018090000)
