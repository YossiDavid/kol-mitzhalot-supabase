-- התראת הודעת צ'אט בשרשור הצעה מובילה לעמוד ההצעה (עם השרשור), לא רק לחדר
-- הצ'אט הכללי, ואומרת שמדובר בהצעה.
--
-- השינוי היחיד ב-notify_chat_message לעומת 20260908100000: זיהוי הקשר החדר.
-- חדר shidduch שההצעה שלו עדיין קיימת:
--   link  = /app/shidduchim/<shidduch_id>#proposal-thread-<sender_id>
--           (העוגן הוא השרשור מול השולח: אצל השדכן - הצד ששלח, אצל ההורה -
--            השדכן, ושניהם מוצגים בעמוד ההצעה)
--   title = 'הודעה חדשה על הצעה מ<שולח>'
-- כל חדר אחר (כללי, כרטיס, או הצעה שנמחקה) נשאר כמו קודם.
-- השאר זהה: התראה אחת לשיחה שמתרעננת, אי-שליחה לשולח, ודילוג על מי שהסתיר.
--
-- אידמפוטנטית - ניתן להריץ שוב.

CREATE OR REPLACE FUNCTION public.notify_chat_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_sender   text;
  v_preview  text;
  v_title    text;
  v_link     text;
  v_kind     text;
  v_shidduch uuid;
  r          record;
BEGIN
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

  SELECT cr.context_kind, cr.shidduch_id
  INTO v_kind, v_shidduch
  FROM public.chat_rooms cr WHERE cr.room_id = NEW.room_id;

  IF v_kind = 'shidduch' AND v_shidduch IS NOT NULL THEN
    v_link := '/app/shidduchim/' || v_shidduch::text
              || '#proposal-thread-' || NEW.sender_id::text;
    v_title := CASE
      WHEN v_sender IS NULL THEN 'הודעה חדשה על הצעה'
      ELSE 'הודעה חדשה על הצעה מ' || v_sender
    END;
  ELSE
    v_link := '/app/chats/' || NEW.room_id::text;
    v_title := CASE
      WHEN v_sender IS NULL THEN 'הודעה חדשה בצ׳אט'
      ELSE 'הודעה חדשה מ' || v_sender
    END;
  END IF;

  v_preview := LEFT(BTRIM(COALESCE(NEW.content, '')), 120);

  FOR r IN
    SELECT crp.user_id
    FROM public.chat_room_participants crp
    WHERE crp.room_id = NEW.room_id
      AND crp.user_id <> NEW.sender_id
      AND crp.deleted_before IS NULL
  LOOP
    UPDATE public.notifications
    SET created_at = now(),
        title      = v_title,
        body       = v_preview,
        link       = v_link
    WHERE user_id = r.user_id
      AND type = 'chat_message'
      AND related_id = NEW.room_id
      AND read_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (r.user_id, 'chat_message', v_title, v_preview, v_link, NEW.room_id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_chat_message() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_chat_message()
  IS 'מתריע למשתתפי השיחה על הודעה חדשה. התראה אחת לשיחה, שמתרעננת. בשרשור הצעה הקישור מוביל לעמוד ההצעה.';
