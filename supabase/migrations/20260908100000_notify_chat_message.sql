-- בעל כרטיס שפונים אליו בצ'אט לא ידע על כך כלל: הצ'אט נכתב מהדפדפן
-- ישירות ל-chat_messages, בלי route שרת ובלי מייל, וההתראות שנבנו
-- קודם כיסו הצעות שידוך ובקשות הצטרפות בלבד.
--
-- העיקרון כאן הוא התראה אחת לשיחה, לא אחת להודעה. עשר הודעות ברצף
-- מייצרות שורה אחת שמתרעננת, אחרת הפעמון מוצף ומאבד ערך. זו גם
-- הסיבה ש-related_id הוא room_id ולא message_id.
--
-- אידמפוטנטית — ניתן להריץ שוב.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'shidduch_offer',
    'shidduch_response',
    'application_reviewed',
    'application_submitted',
    'chat_message'
  ));

CREATE OR REPLACE FUNCTION public.notify_chat_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_sender  text;
  v_preview text;
  v_title   text;
  r         record;
BEGIN
  -- שם השולח מ-user_profiles, ובנפילה ממטא-דאטה. אם אין שם, נשארת
  -- כותרת גנרית ולא מזהה חלקי כמו חצי uuid.
  SELECT NULLIF(BTRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '')
  INTO v_sender
  FROM public.user_profiles p WHERE p.id = NEW.sender_id;

  IF v_sender IS NULL THEN
    SELECT NULLIF(BTRIM(
      COALESCE(u.raw_user_meta_data->>'firstName', '') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'lastName', '')
    ), '')
    INTO v_sender
    FROM auth.users u WHERE u.id = NEW.sender_id;
  END IF;

  v_title := CASE
    WHEN v_sender IS NULL THEN 'הודעה חדשה בצ׳אט'
    ELSE 'הודעה חדשה מ' || v_sender
  END;

  v_preview := LEFT(BTRIM(COALESCE(NEW.content, '')), 120);

  -- כל שאר המשתתפים בחדר. deleted_before מסמן מי הסתיר את השיחה,
  -- ואין טעם להחזיר אותו אליה בהתראה.
  FOR r IN
    SELECT crp.user_id
    FROM public.chat_room_participants crp
    WHERE crp.room_id = NEW.room_id
      AND crp.user_id <> NEW.sender_id
      AND crp.deleted_before IS NULL
  LOOP
    -- קיימת כבר התראה שלא נקראה על אותה שיחה? מרעננים אותה במקום
    -- להוסיף עוד שורה.
    UPDATE public.notifications
    SET created_at = now(),
        title      = v_title,
        body       = v_preview
    WHERE user_id = r.user_id
      AND type = 'chat_message'
      AND related_id = NEW.room_id
      AND read_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (
        r.user_id,
        'chat_message',
        v_title,
        v_preview,
        '/app/chats/' || NEW.room_id::text,
        NEW.room_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_chat_message() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_chat_message()
  IS 'מתריע למשתתפי השיחה על הודעה חדשה. התראה אחת לשיחה, שמתרעננת, כדי לא להציף את הפעמון.';

DROP TRIGGER IF EXISTS trigger_notify_chat_message ON public.chat_messages;
CREATE TRIGGER trigger_notify_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();
