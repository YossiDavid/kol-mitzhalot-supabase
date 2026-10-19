-- "כל ההצעות" לניהול (/app/admin/proposals): יומן השליחות (shidduch_events)
-- עם הסטטוס הנוכחי והיקף השליחה של ההצעה, כדי שאפשר יהיה לסנן לפי סטטוס
-- בשאילתה אחת עם עימוד (בלי רשימת מזהים ארוכה ב-URL).
--
-- security_invoker: ה-RLS של הטבלאות חל על הקורא - shidduch_events נקראת
-- למנהל בלבד, ולכן גם ה-view. הצעה שנמחקה: current_status ו-recipient_scope
-- ריקים (LEFT JOIN).
-- אידמפוטנטית; להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE VIEW public.shidduch_events_report
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.created_at,
  e.shidduch_id,
  e.shadchan_id,
  e.shadchan_name,
  e.student_id,
  e.student_name,
  e.other_student_id,
  e.other_student_name,
  e.side,
  sh.status::text AS current_status,
  sh.recipient_scope
FROM public.shidduch_events e
LEFT JOIN public.shidduchim sh ON sh.id = e.shidduch_id;

REVOKE ALL ON public.shidduch_events_report FROM PUBLIC, anon;
GRANT SELECT ON public.shidduch_events_report TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP VIEW IF EXISTS public.shidduch_events_report;
