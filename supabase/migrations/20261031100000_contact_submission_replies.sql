-- מענה לפניות מהאתר מתוך חלון הפנייה בניהול:
--   1. contact_submissions.status מקבל ערך חדש 'replied' (נענתה). התשובה עצמה
--      נשלחת במייל לפונה מהשרת (route מנהל בלבד), והסטטוס מתעדכן אחריה.
--   2. contact_submission_replies: היסטוריית התשובות לכל פנייה - מי ענה, מתי,
--      מה נכתב, לאיזו כתובת, והאם המייל נשלח בפועל (בפיתוח לא נשלח).
--      author_name הוא צילום של שם המנהל ברגע התשובה, כדי שההיסטוריה תישאר
--      קריאה גם אם הפרופיל ישתנה או יימחק.
--   RLS: מנהלים בלבד קוראים ומוסיפים; אין עדכון ואין מחיקה (מלבד מחיקת
--   הפנייה עצמה, שמוחקת את התשובות שלה ב-CASCADE).
-- אידמפוטנטית - ניתן להריץ שוב בלי שגיאה. Rollback בסוף הקובץ (בהערות).

-- ═══ 1. סטטוס 'replied' ═══════════════════════════════════════════
ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_status_check;
ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_status_check
  CHECK (status IN ('new', 'read', 'replied', 'archived'));

-- ═══ 2. contact_submission_replies ════════════════════════════════
CREATE TABLE IF NOT EXISTS public.contact_submission_replies (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL
    REFERENCES public.contact_submissions (id) ON DELETE CASCADE,
  author_id     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  author_name   text,
  body          text NOT NULL,
  sent_to       text NOT NULL,
  email_sent    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_submission_replies_body_check CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 5000
  )
);

COMMENT ON TABLE public.contact_submission_replies IS
  'תשובות מנהלים לפניות מהאתר (נשלחות במייל לפונה). email_sent=false: נשמרה ולא נשלחה (פיתוח או כשל מסירה).';

CREATE INDEX IF NOT EXISTS contact_submission_replies_submission_idx
  ON public.contact_submission_replies (submission_id, created_at);

ALTER TABLE public.contact_submission_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_submission_replies_admin_select"
  ON public.contact_submission_replies;
CREATE POLICY "contact_submission_replies_admin_select"
  ON public.contact_submission_replies
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- מנהל מוסיף תשובה רק בשמו שלו
DROP POLICY IF EXISTS "contact_submission_replies_admin_insert"
  ON public.contact_submission_replies;
CREATE POLICY "contact_submission_replies_admin_insert"
  ON public.contact_submission_replies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND author_id = auth.uid());

REVOKE ALL ON TABLE public.contact_submission_replies FROM anon;
REVOKE ALL ON TABLE public.contact_submission_replies FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.contact_submission_replies TO authenticated;
GRANT ALL ON TABLE public.contact_submission_replies TO service_role;

-- ═══ Rollback (ידני) ═══════════════════════════════════════════════
-- DROP TABLE IF EXISTS public.contact_submission_replies;
-- UPDATE public.contact_submissions SET status = 'read' WHERE status = 'replied';
-- ALTER TABLE public.contact_submissions
--   DROP CONSTRAINT IF EXISTS contact_submissions_status_check;
-- ALTER TABLE public.contact_submissions
--   ADD CONSTRAINT contact_submissions_status_check
--   CHECK (status IN ('new', 'read', 'archived'));
