-- הודעת הנהלה לכל השדכנים (/app/admin/shadchanim, "שליחת הודעה לכל השדכנים").
--
--  * סוג התראה חדש admin_announcement - הודעה כללית מההנהלה. משמש גם להודעה
--    על דמי ההפרשה למערכת שנשלחת לשדכן חדש עם אישור הבקשה.
--  * send_shadchan_announcement: יוצרת התראה לכל שדכן מאושר שאינו מוקפא (אותו
--    תנאי כמו is_approved_shadchan) ומחזירה את הנמענים - הנתיב שולח להם מייל.
--    service role בלבד: הנתיב מוודא שהמבצע מנהל.
--
-- תוספת בלבד, בטוח להחיל לפני הקוד. אידמפוטנטית.
-- להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. סוגי ההתראות (מ-20261101110000, ועוד admin_announcement) ──────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
    'shidduch_offer'::text, 'shidduch_response'::text, 'application_reviewed'::text,
    'application_submitted'::text, 'chat_message'::text, 'photo_request_submitted'::text,
    'photo_request_reviewed'::text, 'user_registered'::text, 'shidduch_closed_notice'::text,
    'third_party_card_created'::text, 'third_party_card_approved'::text,
    'application_message'::text, 'card_report'::text,
    'card_pending_approval'::text, 'card_approved'::text, 'card_rejected'::text,
    'proposal_disclosure_opened'::text,
    'card_updated'::text, 'card_photos_changed'::text,
    -- חדש
    'admin_announcement'::text
  ]));

-- ── 2. השליחה לכל השדכנים ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_shadchan_announcement(
  p_title text,
  p_body  text
) RETURNS TABLE (recipient_id uuid, email text, first_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF COALESCE(btrim(p_title), '') = '' OR COALESCE(btrim(p_body), '') = '' THEN
    RAISE EXCEPTION 'announcement title and body are required'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH recipients AS (
    SELECT si.user_id
      FROM public.shadchanim_info si
     WHERE si.application_status = 'approved'
       AND si.frozen_at IS NULL
       AND public.has_role(si.user_id, 'shadchan')
  ), inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT r.user_id, 'admin_announcement', btrim(p_title), btrim(p_body)
      FROM recipients r
    RETURNING user_id
  )
  SELECT i.user_id, u.email::text, up.first_name
    FROM inserted i
    JOIN auth.users u ON u.id = i.user_id
    LEFT JOIN public.user_profiles up ON up.id = i.user_id;
END;
$$;

ALTER FUNCTION public.send_shadchan_announcement(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.send_shadchan_announcement(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_shadchan_announcement(text, text) TO service_role;
