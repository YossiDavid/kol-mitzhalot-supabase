-- תיקוני אבטחה להתראות.
--
--   1. create_notification: הייתה SECURITY DEFINER וניתנת להרצה ע"י PUBLIC/anon/
--      authenticated, כלומר כל אחד (גם בלי התחברות) יכול היה לזייף התראה עם
--      קישור חיצוני לכל משתמש. עכשיו: רק service_role (הטריגרים הם SECURITY
--      DEFINER ורצים כבעלים, ולכן אינם מושפעים), והקישור חייב להיות נתיב
--      פנימי יחיד ("/..." ולא "//host" ולא "/\host").
--   2. send_shidduch_closed_notice: דורשת שההצעה אכן ירדה מהפרק, מגבילה קצב
--      (הודעה אחת ל-24 שעות לכל צד בשידוך + תקרה יומית לשולח), ודורשת שהקורא
--      מחזיק כרגע בתפקיד שדכן או מנהל ולא רק שהוא shadchan_id.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 1. create_notification ────────────────────────────────────────
-- קישור לא תקין נדלג עליו בשקט (בלי RAISE): טריגר שקורא לכאן לא ייפול, וגם
-- לא תיווצר התראה עם קישור זדוני. NULL תקין (התראה בלי קישור).
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text DEFAULT NULL,
  p_link    text DEFAULT NULL
) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p_user_id, p_type, p_title, p_body, p_link
  WHERE p_user_id IS NOT NULL
    AND (p_link IS NULL OR p_link ~ '^/([^/\\]|$)');
$$;

ALTER FUNCTION public.create_notification(uuid, text, text, text, text) OWNER TO postgres;
COMMENT ON FUNCTION public.create_notification(uuid, text, text, text, text)
  IS 'יוצר התראה. מתעלם בשקט מנמען חסר ומקישור שאינו נתיב פנימי יחיד (//host וקישורים חיצוניים), כדי שטריגר לא ייפול. להרצה רק ע"י service_role וטריגרים SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO service_role;

-- ── 2. send_shidduch_closed_notice ────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_shidduch_closed_notice(
  p_shidduch_id uuid,
  p_side        text,
  p_message     text
) RETURNS TABLE (notice_id uuid, recipient_user_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  -- מגבלות קצב: הודעה אחת לכל (שידוך, צד) בחלון, ותקרה יומית לשולח
  c_side_window   CONSTANT interval := interval '24 hours';
  c_sender_window CONSTANT interval := interval '24 hours';
  c_sender_daily_max CONSTANT integer := 20;

  v_uid       uuid := auth.uid();
  v_sh        public.shidduchim%ROWTYPE;
  v_message   text := NULLIF(BTRIM(p_message), '');
  v_recipient uuid;
  v_notice    uuid;
  v_is_off    boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '28000';
  END IF;
  IF p_side IS NULL OR p_side NOT IN ('groom', 'bride') THEN
    RAISE EXCEPTION 'invalid_side' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NULL THEN
    RAISE EXCEPTION 'message_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_message) > 500 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22001';
  END IF;

  -- התפקיד חייב להיות בתוקף כרגע: משתמש שהוסר מתפקיד השדכן אך עדיין רשום
  -- כ-shadchan_id של הצעה ישנה לא יכול לשלוח
  IF NOT (public.has_role(v_uid, 'shadchan') OR public.is_admin()) THEN
    RAISE EXCEPTION 'shadchan_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shidduch_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_sh.shadchan_id IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_shadchan' USING ERRCODE = '42501';
  END IF;

  -- הצד חייב להיות נמען בפועל (כמו respond_to_shidduch): אי אפשר
  -- "לעדכן" צד שההצעה מעולם לא נשלחה אליו.
  IF v_sh.status = 'draft'
     OR v_sh.recipient_scope IS NULL
     OR v_sh.recipient_scope NOT IN ('both', p_side || '_only') THEN
    RAISE EXCEPTION 'side_not_recipient' USING ERRCODE = '42501';
  END IF;

  -- ההצעה חייבת להיות באמת "מחוץ לפרק": סטטוס כולל rejected, או תגובת דחייה
  -- של אחד הצדדים. אחרת אפשר היה לשלוח "ההצעה ירדה" על הצעה פעילה.
  v_is_off := v_sh.status = 'rejected'
    OR EXISTS (
      SELECT 1 FROM public.shidduch_responses r
      WHERE r.shidduch_id = v_sh.id AND r.response = 'rejected'
    );
  IF NOT v_is_off THEN
    RAISE EXCEPTION 'proposal_still_active' USING ERRCODE = '55000';
  END IF;

  -- סריאליזציה של בדיקות הקצב, כדי ששתי בקשות מקבילות לא יעקפו את המגבלה
  PERFORM pg_advisory_xact_lock(hashtextextended(v_sh.id::text || ':' || p_side, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('closed-notice-sender:' || v_uid::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.shidduch_closed_notices n
    WHERE n.shidduch_id = v_sh.id
      AND n.side = p_side
      AND n.created_at > now() - c_side_window
  ) THEN
    RAISE EXCEPTION 'notice_already_sent' USING ERRCODE = '54000';
  END IF;

  IF (
    SELECT count(*) FROM public.shidduch_closed_notices n
    WHERE n.sent_by = v_uid
      AND n.created_at > now() - c_sender_window
  ) >= c_sender_daily_max THEN
    RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = '54000';
  END IF;

  v_recipient := public.shidduch_side_owner(v_sh.id, p_side);
  IF v_recipient IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.shidduch_closed_notices (shidduch_id, side, message, sent_by, recipient_user_id)
  VALUES (v_sh.id, p_side, v_message, v_uid, v_recipient)
  RETURNING id INTO v_notice;

  -- שדכן שהוא גם בעל הכרטיס בצד היעד לא מקבל התראה על הודעה של עצמו
  IF v_recipient IS DISTINCT FROM v_uid THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (v_recipient, 'shidduch_closed_notice', 'עדכון בנוגע להצעת שידוך',
            v_message, '/app/proposals', v_sh.id);
  END IF;

  RETURN QUERY SELECT v_notice, v_recipient;
END;
$$;

ALTER FUNCTION public.send_shidduch_closed_notice(uuid, text, text) OWNER TO postgres;

COMMENT ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text)
  IS 'שדכן ההצעה (או מנהל) בתפקיד בתוקף מעדכן צד שקיבל את ההצעה שהיא ירדה מהפרק (סטטוס rejected או תגובת דחייה): תיעוד + התראה בפעמון. הודעה אחת ל-24 שעות לכל (שידוך, צד) ותקרה יומית לשולח. מחזיר את הנמען לשליחת מייל מקוד השרת.';

REVOKE ALL ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_shidduch_closed_notice(uuid, text, text) TO service_role;
