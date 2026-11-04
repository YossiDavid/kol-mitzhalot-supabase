-- צ'אט ישיר רק בין הורה לשדכן, בין שדכנים, או מול מנהל (ממצא 22, החלטת מוצר).
--
-- עד עכשיו כל משתמש מחובר פתח שיחה כללית עם כל משתמש אחר לפי המזהה שלו,
-- כולל הורה מול הורה. שרשורי כרטיס והצעה כבר דרשו שדכן או מנהל באחד הצדדים;
-- עכשיו גם השיחה הכללית. הממשק פותח שיחה כללית רק מול מנהל (באנר ההודעות,
-- כפתור הצ'אט של המנהל) או מול שדכן (contact_shadchan), ולכן אינו מושפע.
-- get_or_create_dm_room עוברת דרך הפונקציה הזו ומקבלת את אותו כלל.
--
-- בפרודקשן אין שיחה כללית בין שני הורים (79 השיחות שאין בהן שדכן פעיל הן
-- מול שדכן שהוקפא מאז). שיחות קיימות לא נסגרות.
--
-- ROLLBACK: להחיל מחדש את get_or_create_context_room
--           מ-20261019100000_card_admin_approval_gate.sql

CREATE OR REPLACE FUNCTION public.get_or_create_context_room(other_user_id uuid, p_context_kind text DEFAULT 'general'::text, p_student_id uuid DEFAULT NULL::uuid, p_shidduch_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  me      uuid := auth.uid();
  v_label text := NULL;
  v_owner uuid;
  v_approved_at timestamptz;
  v_sh    public.shidduchim%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF other_user_id IS NULL OR other_user_id = me THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;
  IF p_context_kind IS NULL OR p_context_kind NOT IN ('general', 'student', 'shidduch') THEN
    RAISE EXCEPTION 'invalid_context';
  END IF;

  IF p_context_kind = 'general' THEN
    -- יעד שנשלח עם general נפסל, כדי שקריאה שגויה לא תיבלע בשקט כשיחה כללית
    IF p_student_id IS NOT NULL OR p_shidduch_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;
    -- חדש: שיחה כללית רק כשאחד הצדדים שדכן פעיל או מנהל (הורה מול שדכן,
    -- שדכן מול שדכן, מנהל מול כל משתמש). הורה מול הורה - לא.
    IF NOT COALESCE(
      public.is_contactable_shadchan(me) OR public.is_contactable_shadchan(other_user_id),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

  ELSIF p_context_kind = 'student' THEN
    -- פנייה על כרטיס: בין בעל הכרטיס לשדכן/מנהל, לכל כיוון. השדכן/מנהל רשאי
    -- לראות כל כרטיס (מדיניות students), ולכן זה התנאי ל"מותר לצפות בכרטיס".
    IF p_student_id IS NULL OR p_shidduch_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    SELECT s.user_id,
           NULLIF(BTRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), ''),
           s.admin_approved_at
    INTO v_owner, v_label, v_approved_at
    FROM public.students s
    WHERE s.id = p_student_id AND s.deleted_at IS NULL;

    IF NOT FOUND OR v_owner IS NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    -- COALESCE: תוצאה NULL (למשל is_admin על משתמש שאינו קיים) חייבת להיחשב דחייה
    IF NOT COALESCE(
      (v_owner = me AND public.is_contactable_shadchan(other_user_id))
      OR (v_owner = other_user_id AND public.is_contactable_shadchan(me)),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

    -- כרטיס שהנהלת המערכת לא אישרה: שרשור עליו נפתח רק בין בעליו למנהל
    IF v_approved_at IS NULL AND NOT COALESCE(
      public.is_admin(CASE WHEN v_owner = me THEN other_user_id ELSE me END),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

    v_label := COALESCE(v_label, 'כרטיס');

  ELSE
    -- שרשור הצעה: השדכן של ההצעה (או מנהל) מול בעל כרטיס של צד שההצעה
    -- נשלחה אליו. שני בעלי הצדדים לעולם אינם מדברים כאן זה עם זה, כי אף אחד
    -- מהם אינו השדכן. טיוטה (או recipient_scope ריק) - ההצעה לא נשלחה.
    IF p_shidduch_id IS NULL OR p_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    SELECT * INTO v_sh FROM public.shidduchim WHERE id = p_shidduch_id;
    IF NOT FOUND OR v_sh.status = 'draft' OR v_sh.recipient_scope IS NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    -- שדכן ההצעה חייב להיות שדכן/מנהל כרגע (תפקיד שנשלל = אין שרשור חדש)
    IF NOT COALESCE(
      (((me = v_sh.shadchan_id AND public.is_contactable_shadchan(me)) OR public.is_admin(me))
         AND public.chat_user_owns_recipient_side(p_shidduch_id, other_user_id))
      OR (((other_user_id = v_sh.shadchan_id AND public.is_contactable_shadchan(other_user_id))
           OR public.is_admin(other_user_id))
         AND public.chat_user_owns_recipient_side(p_shidduch_id, me)),
      false
    ) THEN
      RAISE EXCEPTION 'context_not_allowed';
    END IF;

    v_label := public.chat_shidduch_label(p_shidduch_id);
  END IF;

  RETURN public.chat_find_or_create_room(me, other_user_id, p_context_kind, p_student_id, p_shidduch_id, v_label);
END;
$function$;

ALTER FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid) OWNER TO postgres;

-- הפונקציה הישנה פתוחה גם ל-anon (baseline); היא דורשת התחברות ממילא
REVOKE ALL ON FUNCTION public.get_or_create_dm_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_room(uuid) TO authenticated, service_role;
