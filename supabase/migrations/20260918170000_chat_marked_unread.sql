-- סימון עצמי של שיחה כ"לא נקראה" — "לטיפול בהמשך".
--
-- עד כה "לא נקרא" היה נגזר בלבד: השוואת last_read_at לזמן ההודעה האחרונה,
-- ובמפורש false כשההודעה האחרונה היא של המשתמש עצמו (ראו isRoomUnread).
-- סימון עצמי אינו ניתן לגזירה משום נתון קיים, ולכן הוא נשמר במפורש.
--
-- תוספת עמודה בלבד: שום שורה קיימת אינה משתנה, ו-NULL שקול בדיוק להתנהגות
-- הנוכחית. הסימון נמחק כשהשיחה נפתחת ומסומנת כנקראה, באותו UPDATE.

ALTER TABLE public.chat_room_participants
  ADD COLUMN IF NOT EXISTS marked_unread_at timestamptz;

COMMENT ON COLUMN public.chat_room_participants.marked_unread_at IS
  'סימון עצמי "לא נקרא" (לטיפול בהמשך). NULL = אין סימון. מתאפס כשהשיחה נפתחת ומסומנת כנקראה.';
