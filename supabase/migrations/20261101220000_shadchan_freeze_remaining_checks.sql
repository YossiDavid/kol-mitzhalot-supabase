-- השלמה ל-20261101210000_shadchan_freeze.sql: שדכן מוקפא נחסם גם בבדיקות
-- התפקיד שנשענו ישירות על has_role(..., 'shadchan') ולא על is_shadchan():
--  * send_shidduch_closed_notice - שליחת "ההצעה ירדה"
--  * record_student_card_view    - רישום צפייה בכרטיס
--  * is_contactable_shadchan     - האם אפשר לפנות לשדכן
--  * מדיניות "Student_notes insert scoped" - author_role = 'shadchan'
-- ההגדרות הן ההגדרות האחרונות (pg_get_functiondef / pg_policies) כלשונן; השינוי
-- היחיד הוא תנאי התפקיד, שעכשיו מחריג שדכן מוקפא (is_shadchan_frozen).
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.send_shidduch_closed_notice(p_shidduch_id uuid, p_side text, p_message text)
 RETURNS TABLE(notice_id uuid, recipient_user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
  IF NOT ((public.has_role(v_uid, 'shadchan') AND NOT public.is_shadchan_frozen(v_uid))
          OR public.is_admin()) THEN
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
$function$

;

CREATE OR REPLACE FUNCTION public.record_student_card_view(p_student_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_student_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.has_role(v_uid, 'shadchan') OR public.is_shadchan_frozen(v_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.student_card_views AS v (student_id, viewer_id)
  SELECT s.id, v_uid
  FROM public.students s
  WHERE s.id = p_student_id
    AND s.deleted_at IS NULL
    AND s.user_id <> v_uid
  ON CONFLICT (student_id, viewer_id) DO UPDATE
    SET last_viewed_at = now(),
        view_count     = v.view_count + 1;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.is_contactable_shadchan(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT (public.has_role(uid, 'shadchan') AND NOT public.is_shadchan_frozen(uid))
    OR public.has_role(uid, 'admin');
$function$

;

-- מדיניות ההוספה: ההגדרה האחרונה, עם is_shadchan() (שמחריגה שדכן מוקפא)
-- במקום has_role(auth.uid(), 'shadchan') בענף author_role = 'shadchan'
DROP POLICY IF EXISTS "Student_notes insert scoped" ON public.student_notes;
CREATE POLICY "Student_notes insert scoped" ON public.student_notes
  FOR INSERT TO public
  WITH CHECK (
    (author_id = auth.uid())
    AND (public.is_shadchan_or_admin() OR public.staff_can_access_student(auth.uid(), student_id))
    AND (
      ((author_role = 'staff'::text) AND public.staff_can_access_student(auth.uid(), student_id))
      OR ((author_role = 'shadchan'::text) AND public.is_shadchan())
      OR ((author_role = 'admin'::text) AND public.has_role(auth.uid(), 'admin'::text))
    )
  );

-- ── Rollback (להריץ ידנית) ──
-- להחזיר את שלוש הפונקציות ואת המדיניות לתנאי has_role(..., 'shadchan') המקורי
-- (ההגדרות שלמעלה בלי is_shadchan_frozen / עם has_role(auth.uid(), 'shadchan') במדיניות).
