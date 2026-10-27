-- מייל על הודעת צ'אט חדשה למנהל כרטיס (משתמש שאינו שדכן/מנהל): לא כולם
-- נכנסים למערכת, וההודעה מהשדכן נשארה בלי מענה. השליחה בשרת
-- (POST /api/v1/chats/:roomId/email-notify), ומוגבלת למייל אחד לשיחה בכל
-- חצי שעה - הטבלה שומרת מתי נשלח המייל האחרון לכל נמען בכל שיחה.
--
-- service role בלבד: RLS פעיל בלי מדיניות, ובלי הרשאות ל-anon/authenticated.

CREATE TABLE IF NOT EXISTS public.chat_email_notices (
  room_id      uuid NOT NULL REFERENCES public.chat_rooms(room_id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

COMMENT ON TABLE public.chat_email_notices IS
  'מתי נשלח לנמען המייל האחרון על הודעה חדשה בשיחה (הגבלת תדירות). service role בלבד';

ALTER TABLE public.chat_email_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_email_notices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.chat_email_notices TO service_role;

-- ── rollback ─────────────────────────────────────────────────────────
--   להסיר את הטבלה chat_email_notices
