-- פתיחת מידע נוסף בהצעה אחרי השליחה, עם התראה לצד שקיבל אותה (תוספת בלבד,
-- בטוח להחיל לפני הקוד: הקוד שבאוויר אינו קורא לפונקציה).
--
-- השדכן של ההצעה (או מנהל) משנה בדף ההצעה את מה שהצדדים רואים: קו"ח, פרטי
-- ממליצים, הצהרה רפואית, תמונת הבחור. לעולם לא פרטי התקשרות של המיועד/ת או
-- ההורים - אין להם דגל. פריט שנפתח (false -> true) בהצעה שכבר נשלחה: התראה
-- למנהל הכרטיס של כל צד שההצעה נשלחה אליו (recipient_scope). כמה פריטים בשמירה
-- אחת - התראה אחת. הגבלה: התראה אחת לכל צד בכל הצעה בשעה; פתיחה נוספת בתוך
-- השעה מתמזגת לאותה התראה (הרשימה מתעדכנת והיא מסומנת שוב כלא נקראה) ואינה
-- שולחת מייל נוסף. סגירה - בשקט. טיוטה - בלי התראות.
-- תמונת הבחור רלוונטית רק לצד הכלה, ולכן נכללת רק בהתראה אליו.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

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
    'proposal_disclosure_opened'::text
  ]));

CREATE OR REPLACE FUNCTION public.set_proposal_disclosure(
    p_shidduch_id uuid,
    p_share_cv boolean,
    p_share_references boolean,
    p_share_medical boolean,
    p_share_groom_photo boolean
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  c_window CONSTANT interval := interval '1 hour';
  c_labels CONSTANT text[] := ARRAY['קובץ קו"ח', 'פרטי הממליצים', 'הצהרה רפואית', 'תמונת הבחור'];
  v_uid uuid := auth.uid();
  v_sh public.shidduchim%ROWTYPE;
  v_opened boolean[];
  v_side text;
  v_card uuid;
  v_other uuid;
  v_owner uuid;
  v_existing public.notifications%ROWTYPE;
  v_items text[];
  v_body text;
  v_notified jsonb := '[]'::jsonb;
  i integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_share_cv IS NULL OR p_share_references IS NULL
     OR p_share_medical IS NULL OR p_share_groom_photo IS NULL THEN
    RAISE EXCEPTION 'invalid_flags' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    COALESCE(public.is_admin(), false)
    OR (v_sh.shadchan_id = v_uid AND COALESCE(public.is_shadchan_or_admin(), false))
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  -- מה נפתח עכשיו, לפי המצב בפועל (קו"ח פתוח גם בדגל הישן)
  v_opened := ARRAY[
    p_share_cv AND NOT (v_sh.share_cv OR v_sh.share_contact_details),
    p_share_references AND NOT v_sh.share_references,
    p_share_medical AND NOT v_sh.share_medical_info,
    p_share_groom_photo AND NOT v_sh.share_groom_photo
  ];

  UPDATE public.shidduchim
     SET share_cv = p_share_cv,
         share_contact_details = false,
         share_references = p_share_references,
         share_medical_info = p_share_medical,
         share_groom_photo = p_share_groom_photo
   WHERE id = p_shidduch_id;

  IF v_sh.status::text = 'draft' OR v_sh.sent_at IS NULL THEN
    RETURN jsonb_build_object('notified', v_notified);
  END IF;

  FOREACH v_side IN ARRAY public.shidduch_scope_sides(v_sh.recipient_scope) LOOP
    v_card := CASE v_side WHEN 'groom' THEN v_sh.groom_id ELSE v_sh.bride_id END;
    v_other := CASE v_side WHEN 'groom' THEN v_sh.bride_id ELSE v_sh.groom_id END;
    SELECT s.user_id INTO v_owner
      FROM public.students s WHERE s.id = v_card AND s.deleted_at IS NULL;
    CONTINUE WHEN v_owner IS NULL;

    v_items := ARRAY[]::text[];
    FOR i IN 1..4 LOOP
      -- תמונת הבחור: רק לצד הכלה
      IF v_opened[i] AND NOT (i = 4 AND v_side <> 'bride') THEN
        v_items := v_items || c_labels[i];
      END IF;
    END LOOP;
    CONTINUE WHEN cardinality(v_items) = 0;

    SELECT * INTO v_existing
      FROM public.notifications n
     WHERE n.user_id = v_owner
       AND n.type = 'proposal_disclosure_opened'
       AND n.related_id = p_shidduch_id
       AND n.created_at > now() - c_window
     ORDER BY n.created_at DESC
     LIMIT 1;

    IF FOUND THEN
      -- מיזוג: הפריטים שכבר הופיעו בהתראה נשמרים, בסדר הקבוע
      v_items := ARRAY(
        SELECT l FROM unnest(c_labels) WITH ORDINALITY AS t(l, o)
         WHERE l = ANY (v_items) OR position(l IN COALESCE(v_existing.body, '')) > 0
         ORDER BY o
      );
      v_body := 'השדכן פתח לך מידע נוסף בהצעה: ' || array_to_string(v_items, ', ') || '.';
      UPDATE public.notifications
         SET body = v_body, read_at = NULL
       WHERE id = v_existing.id;
    ELSE
      v_body := 'השדכן פתח לך מידע נוסף בהצעה: ' || array_to_string(v_items, ', ') || '.';
      INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
      VALUES (v_owner, 'proposal_disclosure_opened', 'מידע נוסף נפתח לך בהצעה',
              v_body, '/app/students/' || v_other, p_shidduch_id);
      v_notified := v_notified || jsonb_build_object(
        'user_id', v_owner, 'side', v_side, 'other_student_id', v_other,
        'items', to_jsonb(v_items));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('notified', v_notified);
END;
$$;

ALTER FUNCTION public.set_proposal_disclosure(uuid, boolean, boolean, boolean, boolean) OWNER TO postgres;
COMMENT ON FUNCTION public.set_proposal_disclosure(uuid, boolean, boolean, boolean, boolean) IS
  'השדכן של ההצעה או מנהל: מה הצדדים רואים (קו"ח, ממליצים, רפואי, תמונת הבחור). מתריע לצדדים שקיבלו את ההצעה על פריטים שנפתחו; מחזיר את מי שקיבל התראה חדשה (לצורך מייל)';
REVOKE ALL ON FUNCTION public.set_proposal_disclosure(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_proposal_disclosure(uuid, boolean, boolean, boolean, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP FUNCTION IF EXISTS public.set_proposal_disclosure(uuid, boolean, boolean, boolean, boolean);
--   DELETE FROM public.notifications WHERE type = 'proposal_disclosure_opened';
--   -- ואז להריץ שוב את החלק של notifications_type_check מתוך 20261019090000_card_admin_approval.sql
--   NOTIFY pgrst, 'reload schema';
