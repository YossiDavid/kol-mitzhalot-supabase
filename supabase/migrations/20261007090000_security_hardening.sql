-- הקשחת אבטחה (ממצאי סקירה):
--   1. צ'אט: הרשאות כתיבה על chat_room_participants ו-chat_messages
--   2. הצעות: עקיפת מכסת ההצעות וההשהיה בכתיבה ישירה ל-shidduchim
--   3. מודעות מאורסים: פרטי קשר ומזהים פנימיים אינם נקראים ע"י anon/authenticated
--   4. get_or_create_context_room: שדכן ההצעה חייב להיות שדכן/מנהל כרגע
--   5. create_notification: קישור עם תו רווח/בקרה אחרי "/" נפסל
--
-- אידמפוטנטית - ניתן להריץ שוב בלי שגיאה.

-- ═══ 1. צ'אט ═══════════════════════════════════════════════════════
-- שורות chat_room_participants נוצרות רק ב-chat_find_or_create_room
-- (SECURITY DEFINER, בעלים postgres - עוקף RLS וגם הרשאות עמודה). הלקוח
-- אינו מכניס שורות: כך יוצר חדר אינו יכול להוסיף צד שלישי לחדר (שיקרא
-- את כל השרשור, יקבל התראות ויעקוף את מכסת הפניות היומית).
DROP POLICY IF EXISTS "participants_insert_room_creator" ON public.chat_room_participants;

-- הלקוח מעדכן רק את סימוני השורה שלו: נקרא/לא נקרא (use-mark-room-read,
-- mark-room-unread) ומחיקה/הסתרה "אצלי" (deleted_before, hidden_at).
-- room_id ו-user_id (ו-joined_at) אינם ניתנים לשינוי: עדכון room_id של שורה
-- עצמית היה הופך את המשתמש למשתתף בחדר כלשהו.
REVOKE ALL ON TABLE public.chat_room_participants FROM PUBLIC;
REVOKE ALL ON TABLE public.chat_room_participants FROM anon;
REVOKE ALL ON TABLE public.chat_room_participants FROM authenticated;
GRANT SELECT ON TABLE public.chat_room_participants TO authenticated;
GRANT UPDATE (last_read_at, marked_unread_at, hidden_at, deleted_before)
  ON TABLE public.chat_room_participants TO authenticated;
GRANT ALL ON TABLE public.chat_room_participants TO service_role;

-- הערה: ה-WITH CHECK אינו יכול להשוות ל-OLD, לכן נעילת room_id/user_id
-- נאכפת בהרשאות העמודה למעלה, והמדיניות נשארת "רק השורה שלי".
DROP POLICY IF EXISTS "participants_update_self_only" ON public.chat_room_participants;
CREATE POLICY "participants_update_self_only" ON public.chat_room_participants
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- הודעה: עריכה רק של התוכן וחותמת העריכה. בלי room_id, sender_id, created_at
-- (העברת הודעה לחדר אחר), reply_to_message_id.
REVOKE ALL ON TABLE public.chat_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.chat_messages FROM anon;
REVOKE ALL ON TABLE public.chat_messages FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.chat_messages TO authenticated;
GRANT UPDATE (content, edited_at) ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;

-- chat_rooms: ההכנסה הישירה (rooms_insert_creator_canonical, ושדרוגה ב-20261006120000)
-- כבר מחייבת שהמבצע הוא user_a או user_b. חדר בלי משתתפים אינו שימושי.

-- ═══ 2. מכסה והשהיה על shidduchim ═══════════════════════════════════
-- המודל: "שליחה" = מעבר מ-(אין שורה | draft | rejected) לסטטוס פעיל עם
-- recipient_scope, ובנוסף כל צד שנוסף להיקף של שורה פעילה. היא נבדקת
-- בשער עבור כל צד בהיקף, בלי קשר ל-sent_at (עדכון אחד שמעביר טיוטה ישר
-- ל-sent עם sent_at, או פתיחה מחדש של שורה שנדחתה ועדיין נושאת sent_at,
-- נחשבים שליחה). השלמת שלב שני (sent_at: NULL -> ערך, אותו היקף, שורה
-- שכבר פעילה) אינה שליחה חדשה - רק היא פטורה.
--
-- פטור יחיד: הורה שחוזר בו מדחייה דרך respond_to_shidduch (rejected -> פעיל,
-- בלי שינוי היקף/sent_at, והמבצע אינו השדכן ואינו מנהל). שדכן, מנהל ו-service
-- role (auth.uid() ריק) נבדקים תמיד.
CREATE OR REPLACE FUNCTION public.shidduch_gate_sides(
  p_old_status text,
  p_old_scope  text,
  p_new_status text,
  p_new_scope  text
) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(array_agg(side ORDER BY side DESC), ARRAY[]::text[])
  FROM unnest(
    CASE WHEN p_new_status IN ('draft', 'rejected') THEN ARRAY[]::text[]
         ELSE public.shidduch_scope_sides(p_new_scope) END
  ) AS side
  WHERE NOT (
    p_old_status IS NOT NULL
    AND p_old_status NOT IN ('draft', 'rejected')
    AND side = ANY (public.shidduch_scope_sides(p_old_scope))
  );
$$;

-- הצדדים שיירשמו ביומן: כמו שער, אבל רק כש-sent_at מוגדר (סוף השליחה,
-- אחרי המייל), ו"כבר נשלח" דורש שורה פעילה שכבר נשאה sent_at.
CREATE OR REPLACE FUNCTION public.shidduch_logged_sides(
  p_old_status  text,
  p_old_sent_at timestamptz,
  p_old_scope   text,
  p_new_status  text,
  p_new_sent_at timestamptz,
  p_new_scope   text
) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(array_agg(side ORDER BY side DESC), ARRAY[]::text[])
  FROM unnest(
    CASE WHEN p_new_status IN ('draft', 'rejected') OR p_new_sent_at IS NULL
         THEN ARRAY[]::text[]
         ELSE public.shidduch_scope_sides(p_new_scope) END
  ) AS side
  WHERE NOT (
    p_old_status IS NOT NULL
    AND p_old_status NOT IN ('draft', 'rejected')
    AND p_old_sent_at IS NOT NULL
    AND side = ANY (public.shidduch_scope_sides(p_old_scope))
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sides    text[];
  v_side     text;
  v_student  uuid;
  v_quota    record;
  v_pending  integer;
  v_uid      uuid := auth.uid();
BEGIN
  IF NEW.recipient_scope IS NULL OR NEW.status::text IN ('draft', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_sides := public.shidduch_gate_sides(NULL, NULL, NEW.status::text, NEW.recipient_scope);
  ELSE
    -- הורה שחוזר בו מדחייה (respond_to_shidduch): לא "קבלת הצעה" חדשה
    IF OLD.status::text = 'rejected'
       AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope
       AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
       AND v_uid IS NOT NULL
       AND v_uid IS DISTINCT FROM NEW.shadchan_id
       AND NOT public.is_admin() THEN
      RETURN NEW;
    END IF;
    v_sides := public.shidduch_gate_sides(OLD.status::text, OLD.recipient_scope, NEW.status::text, NEW.recipient_scope);
  END IF;

  FOREACH v_side IN ARRAY v_sides LOOP
    v_student := CASE v_side WHEN 'groom' THEN NEW.groom_id ELSE NEW.bride_id END;

    -- נעילה לכל כרטיס עד סוף הטרנזקציה: שתי שליחות מקבילות לאותו כרטיס
    -- נבדקות בזו אחר זו ולא שתיהן מול אותה ספירה (הצדדים ממוינים, ללא deadlock)
    PERFORM pg_advisory_xact_lock(hashtext('shidduch_card_gate'), hashtext(v_student::text));

    SELECT * INTO v_quota FROM public.student_proposal_quota(v_student);
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_quota.is_paused THEN
      RAISE EXCEPTION 'card_paused' USING ERRCODE = 'P0001', DETAIL = v_side;
    END IF;

    IF v_quota.limit_count IS NOT NULL THEN
      -- שליחות בשלב הראשון (sent_at ריק, עוד לא ביומן) תופסות מקום: אחרת שתי
      -- שליחות מקבילות בשני שלבים היו עוברות שתיהן את אותה ספירת יומן
      SELECT count(*)::integer INTO v_pending
        FROM public.shidduchim sh
       WHERE sh.id <> NEW.id
         AND sh.sent_at IS NULL
         AND sh.status::text NOT IN ('draft', 'rejected')
         AND v_side = ANY (public.shidduch_scope_sides(sh.recipient_scope))
         AND CASE v_side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END = v_student
         AND NOT EXISTS (
           SELECT 1 FROM public.shidduch_events e
            WHERE e.shidduch_id = sh.id AND e.student_id = v_student
         );

      IF v_quota.used_count + v_pending >= v_quota.limit_count THEN
        RAISE EXCEPTION 'proposal_limit_reached' USING ERRCODE = 'P0001', DETAIL = v_side;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_shidduch_card_gates() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_enforce_shidduch_card_gates ON public.shidduchim;
CREATE TRIGGER trigger_enforce_shidduch_card_gates
  BEFORE INSERT OR UPDATE ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shidduch_card_gates();

CREATE OR REPLACE FUNCTION public.log_shidduch_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_sides          text[];
  v_side           text;
  v_shadchan_name  text;
  v_groom_name     text;
  v_bride_name     text;
  v_uid            uuid := auth.uid();
BEGIN
  IF NEW.sent_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_sides := public.shidduch_logged_sides(NULL, NULL, NULL, NEW.status::text, NEW.sent_at, NEW.recipient_scope);
  ELSE
    IF NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
       AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope THEN
      RETURN NEW;
    END IF;
    -- חזרה מדחייה ע"י הורה: אותו פטור כמו בשער, ולכן גם לא נרשמת שליחה
    IF OLD.status::text = 'rejected'
       AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope
       AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
       AND v_uid IS NOT NULL
       AND v_uid IS DISTINCT FROM NEW.shadchan_id
       AND NOT public.is_admin() THEN
      RETURN NEW;
    END IF;
    v_sides := public.shidduch_logged_sides(OLD.status::text, OLD.sent_at, OLD.recipient_scope, NEW.status::text, NEW.sent_at, NEW.recipient_scope);
  END IF;

  IF COALESCE(array_length(v_sides, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
           NULLIF(btrim(COALESCE(u.raw_user_meta_data->>'firstName', '') || ' ' || COALESCE(u.raw_user_meta_data->>'lastName', '')), ''),
           u.email)
    INTO v_shadchan_name
    FROM auth.users u
   WHERE u.id = NEW.shadchan_id;

  SELECT btrim(s.first_name || ' ' || s.last_name) INTO v_groom_name FROM public.students s WHERE s.id = NEW.groom_id;
  SELECT btrim(s.first_name || ' ' || s.last_name) INTO v_bride_name FROM public.students s WHERE s.id = NEW.bride_id;

  FOREACH v_side IN ARRAY v_sides LOOP
    INSERT INTO public.shidduch_events (
      shidduch_id, shadchan_id, student_id, other_student_id, side, kind,
      created_at, shadchan_name, student_name, other_student_name
    ) VALUES (
      NEW.id, NEW.shadchan_id,
      CASE v_side WHEN 'groom' THEN NEW.groom_id ELSE NEW.bride_id END,
      CASE v_side WHEN 'groom' THEN NEW.bride_id ELSE NEW.groom_id END,
      v_side, 'offer_sent',
      NEW.sent_at, v_shadchan_name,
      CASE v_side WHEN 'groom' THEN v_groom_name ELSE v_bride_name END,
      CASE v_side WHEN 'groom' THEN v_bride_name ELSE v_groom_name END
    );
  END LOOP;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_shidduch_events() OWNER TO postgres;

-- גם על status: פתיחה מחדש של שורה שנדחתה (שעדיין נושאת sent_at) היא שליחה
DROP TRIGGER IF EXISTS trigger_log_shidduch_events ON public.shidduchim;
CREATE TRIGGER trigger_log_shidduch_events
  AFTER INSERT OR UPDATE OF status, sent_at, recipient_scope ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.log_shidduch_events();

-- ההגדרה הישנה (sent_at בשורה הקודמת = "כבר נשלח", בלי התחשבות בסטטוס)
-- הוחלפה בשתי הפונקציות החדשות
DROP FUNCTION IF EXISTS public.shidduch_new_receiving_sides(timestamptz, text, text, timestamptz, text);

-- ═══ 3. מודעות מאורסים ══════════════════════════════════════════════
-- מודעות שנוצרו אוטומטית שמרו טלפון ומייל של השדכן הפועל. הקוד כבר לא כותב
-- אותם (close-match.ts); כאן מנקים את מה שנשמר.
UPDATE public.engagements
   SET submitter_phone = NULL, submitter_email = NULL
 WHERE source = 'system'
   AND (submitter_phone IS NOT NULL OR submitter_email IS NOT NULL);

-- anon/authenticated קוראים רק את עמודות המודעה עצמה (מה שהאתר מציג, בצירוף
-- closed_at). submitter_*, שמות האבות/ישיבה/סמינר ומזהי השידוך והכרטיסים
-- סגורים. כתיבה (הטופס הציבורי וניהול) אינה מושפעת. השדות המלאים למנהל
-- מוגשים ב-admin_list_engagements.
REVOKE SELECT ON TABLE public.engagements FROM PUBLIC;
REVOKE SELECT ON TABLE public.engagements FROM anon;
REVOKE SELECT ON TABLE public.engagements FROM authenticated;
GRANT SELECT (id, groom_name, bride_name, groom_city, bride_city, shadchan_name, closed_at, is_published, created_at)
  ON TABLE public.engagements TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_engagements() RETURNS SETOF public.engagements
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.engagements e ORDER BY e.created_at DESC;
END;
$$;

ALTER FUNCTION public.admin_list_engagements() OWNER TO postgres;
COMMENT ON FUNCTION public.admin_list_engagements()
  IS 'כל שדות המודעות (כולל submitter_* ומזהים פנימיים) - למנהל בלבד. הקריאה הישירה לטבלה חושפת רק עמודות ציבוריות.';

REVOKE ALL ON FUNCTION public.admin_list_engagements() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_engagements() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_engagements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_engagements() TO service_role;

-- ═══ 4. get_or_create_context_room ═════════════════════════════════
-- ענף ההצעה: מי ששמו shadchan_id חייב להחזיק כרגע בתפקיד שדכן או מנהל
-- (is_contactable_shadchan), לא רק להיות רשום על ההצעה. שאר הפונקציה ללא שינוי.
CREATE OR REPLACE FUNCTION public.get_or_create_context_room(
  other_user_id   uuid,
  p_context_kind  text DEFAULT 'general',
  p_student_id    uuid DEFAULT NULL,
  p_shidduch_id   uuid DEFAULT NULL
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  me      uuid := auth.uid();
  v_label text := NULL;
  v_owner uuid;
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
    -- התנהגות קיימת: שיחה כללית פתוחה לכל זוג. יעד שנשלח עם general נפסל,
    -- כדי שקריאה שגויה לא תיבלע בשקט כשיחה כללית.
    IF p_student_id IS NOT NULL OR p_shidduch_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

  ELSIF p_context_kind = 'student' THEN
    -- פנייה על כרטיס: בין בעל הכרטיס לשדכן/מנהל, לכל כיוון. השדכן/מנהל רשאי
    -- לראות כל כרטיס (מדיניות students), ולכן זה התנאי ל"מותר לצפות בכרטיס".
    IF p_student_id IS NULL OR p_shidduch_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_context';
    END IF;

    SELECT s.user_id,
           NULLIF(BTRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), '')
    INTO v_owner, v_label
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
$$;

ALTER FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid)
  IS 'פותחת או מחזירה חדר צ''אט לפי הקשר (general | student | shidduch), עם בדיקת הרשאה בשרת. מחליפה את get_or_create_dm_room לכל שימוש עם הקשר.';

REVOKE ALL ON FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_context_room(uuid, text, uuid, uuid) TO service_role;

-- ═══ 5. create_notification ════════════════════════════════════════
-- דפדפן מסיר טאב/שורה חדשה מכתובת, ולכן "/<TAB>/evil.com" הופך ל-//evil.com.
-- הקישור חייב להיות נתיב פנימי יחיד וללא רווחים/תווי בקרה בכלל.
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
    AND (
      p_link IS NULL
      OR (
        p_link ~ '^/([^/\\[:space:][:cntrl:]]|$)'
        AND p_link !~ '[[:space:][:cntrl:]]'
      )
    );
$$;

ALTER FUNCTION public.create_notification(uuid, text, text, text, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text) TO service_role;
