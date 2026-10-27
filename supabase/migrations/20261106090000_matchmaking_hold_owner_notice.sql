-- "בתהליך שידוך": כשההנהלה מסמנת או מסירה את הסימון, מנהל הכרטיס מקבל
-- התראה (עד עכשיו הכרטיס פשוט הפסיק לקבל הצעות בלי שהוא ידע). כשמנהל הכרטיס
-- מסמן בעצמו אין התראה. הרשאות הסימון לא השתנו: מנהל הכרטיס או מנהל מערכת
-- בלבד, וסימון של ההנהלה מוסר רק בידי מנהל.
--
-- הגוף מ-20261104150000_card_matchmaking_hold.sql; השינוי מסומן "חדש".

CREATE OR REPLACE FUNCTION public.set_card_matchmaking_hold(
  p_student_id uuid,
  p_on boolean,
  p_reason text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_hold_by uuid;
  v_reason text := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  v_was_on boolean;
  v_name   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  SELECT s.user_id, s.matchmaking_hold_by, s.matchmaking_hold_at IS NOT NULL,
         NULLIF(BTRIM(COALESCE(s.first_name, '')), '')
    INTO v_owner, v_hold_by, v_was_on, v_name
    FROM public.students s
   WHERE s.id = p_student_id AND s.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_owner IS DISTINCT FROM v_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  -- סימון שהציבה ההנהלה מוסר רק בידי מנהל
  IF NOT p_on AND NOT public.is_admin()
     AND v_hold_by IS NOT NULL AND v_hold_by IS DISTINCT FROM v_uid
     AND public.has_role(v_hold_by, 'admin') THEN
    RAISE EXCEPTION 'hold_set_by_admin' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22001';
  END IF;

  PERFORM set_config('app.matchmaking_hold_rpc', 'on', true);
  UPDATE public.students
     SET matchmaking_hold_at     = CASE WHEN p_on THEN now() ELSE NULL END,
         matchmaking_hold_reason = CASE WHEN p_on THEN v_reason ELSE NULL END,
         matchmaking_hold_by     = CASE WHEN p_on THEN v_uid ELSE NULL END
   WHERE id = p_student_id;
  PERFORM set_config('app.matchmaking_hold_rpc', 'off', true);

  -- חדש: ההנהלה סימנה או הסירה - מנהל הכרטיס מקבל עדכון (כשהוא עצמו סימן,
  -- אין מה לעדכן). רק כשהמצב השתנה בפועל.
  IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM v_uid
     AND p_on IS DISTINCT FROM v_was_on THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      v_owner,
      'card_updated',
      CASE WHEN p_on THEN 'הכרטיס סומן "בתהליך שידוך"'
           ELSE 'הוסר סימון "בתהליך שידוך"' END,
      CASE WHEN p_on THEN
             'הנהלת המערכת סימנה את הכרטיס' || COALESCE(' של ' || v_name, '')
             || ' "בתהליך שידוך". עד להסרת הסימון לא יישלחו אליו הצעות חדשות.'
             || COALESCE(' הסיבה: ' || v_reason, '')
             || ' להסרה יש לפנות להנהלה.'
           ELSE
             'הכרטיס' || COALESCE(' של ' || v_name, '')
             || ' שוב פתוח לקבלת הצעות.'
      END,
      '/app/students/' || p_student_id,
      p_student_id
    );
  END IF;
END;
$function$;

ALTER FUNCTION public.set_card_matchmaking_hold(uuid, boolean, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_card_matchmaking_hold(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_card_matchmaking_hold(uuid, boolean, text) TO authenticated;

-- ── rollback ─────────────────────────────────────────────────────────
--   להחזיר את set_card_matchmaking_hold מ-20261104150000_card_matchmaking_hold.sql
