-- chat_room_participants ב-realtime: סימון קריאה שנעשה במכשיר אחר מגיע
-- ללשונית הזו מיד, ולא רק בחזרה אליה (visibilitychange).
--
-- אבטחה: מדיניות ה-SELECT participants_select_in_my_rooms מתירה לי לראות את
-- שורות המשתתפים בשיחות שאני צד בהן — כלומר גם את השורה של הצד השני, עם
-- last_read_at שלו. זו אותה נראות שכבר קיימת ב-REST, ו-realtime אינו מרחיב
-- אותה. הלקוח נרשם עם filter=user_id=eq.<המשתמש שלי>, כך שבפועל מגיעות אליו
-- רק השורות שלו.
--
-- ADD TABLE אינו אידמפוטנטי ונופל ב-42710 אם הטבלה כבר בפרסום.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_participants;
  END IF;
END
$do$;
