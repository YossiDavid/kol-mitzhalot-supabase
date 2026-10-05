-- שיחות עם הקשר: כרטיס או הצעת שידוך.
--
-- עד כה היה חדר אחד בלבד לכל זוג משתמשים (chat_rooms_unique_pair_idx), ולכן
-- פנייה על כרטיס, שיחה על הצעה ושיחה כללית התערבבו באותו רצף, והצ'אט לא ידע
-- על מה מדברים. כאן נוספים לחדר הקשר, ובין אותם שני משתמשים יכולים להתקיים
-- כמה חדרים - "שרשורים":
--
--   general  - השיחה הכללית (כל החדרים הקיימים). חדר אחד לזוג.
--   student  - פנייה בנוגע לכרטיס. חדר אחד לזוג ולכרטיס.
--   shidduch - שרשור של הצעת שידוך בין השדכן לבעל כרטיס של אחד הצדדים.
--              חדר אחד לזוג ולהצעה.
--
-- student_id / shidduch_id הם ON DELETE SET NULL: הצעות נמחקות פיזית, והשיחה
-- חייבת לשרוד. context_label הוא צילום שם שנלקח ביצירה (שם המיועד/ת, או
-- "X ו-Y"), כדי שלחדר שהיעד שלו נעלם עדיין תהיה כותרת.
--
-- אבטחה: ההרשאה ליצור חדר הקשר נבדקת אך ורק ב-get_or_create_context_room
-- (SECURITY DEFINER). מדיניות ה-INSERT הישירה על chat_rooms מוגבלת כאן לחדר
-- general, כדי שלקוח לא יוכל לעקוף את הבדיקה ולכתוב הקשר לפי רצונו.
--
-- אידמפוטנטית - ניתן להריץ שוב.

-- ── 1. עמודות ──────────────────────────────────────────────────────
ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS context_kind  text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS student_id    uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shidduch_id   uuid REFERENCES public.shidduchim(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context_label text;

ALTER TABLE public.chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_context_kind_check;
ALTER TABLE public.chat_rooms
  ADD CONSTRAINT chat_rooms_context_kind_check
  CHECK (context_kind IN ('general', 'student', 'shidduch'));

-- אין CHECK שמחייב student_id/shidduch_id בחדר הקשר: SET NULL ממחיקת היעד
-- היה נכשל עליו, ובדיוק זה המצב שבו החדר צריך לשרוד.
-- חדר general לעולם אינו נושא יעד.
ALTER TABLE public.chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_general_has_no_target;
ALTER TABLE public.chat_rooms
  ADD CONSTRAINT chat_rooms_general_has_no_target
  CHECK (context_kind <> 'general' OR (student_id IS NULL AND shidduch_id IS NULL));

COMMENT ON COLUMN public.chat_rooms.context_kind  IS 'general | student | shidduch - על מה השיחה. נקבע רק ב-get_or_create_context_room';
COMMENT ON COLUMN public.chat_rooms.student_id    IS 'הכרטיס של חדר student. NULL אחרי מחיקת הכרטיס (החדר נשאר)';
COMMENT ON COLUMN public.chat_rooms.shidduch_id   IS 'ההצעה של חדר shidduch. NULL אחרי מחיקת ההצעה (החדר נשאר)';
COMMENT ON COLUMN public.chat_rooms.context_label IS 'צילום שם ההקשר ביצירה (שם המיועד/ת או "X ו-Y"), כדי שלחדר שהיעד שלו נמחק תהיה כותרת';

CREATE INDEX IF NOT EXISTS idx_chat_rooms_student_id
  ON public.chat_rooms (student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_rooms_shidduch_id
  ON public.chat_rooms (shidduch_id) WHERE shidduch_id IS NOT NULL;

-- ── 2. ייחודיות לפי הקשר ───────────────────────────────────────────
-- NULL נחשב שונה בכל אינדקס ייחודי, ולכן חדרים שהיעד שלהם נמחק (NULL) לא
-- מתנגשים זה בזה.
DROP INDEX IF EXISTS public.chat_rooms_unique_pair_idx;

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_general_pair_idx
  ON public.chat_rooms (user_a, user_b)
  WHERE context_kind = 'general';

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_student_pair_idx
  ON public.chat_rooms (user_a, user_b, student_id)
  WHERE context_kind = 'student';

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_shidduch_pair_idx
  ON public.chat_rooms (user_a, user_b, shidduch_id)
  WHERE context_kind = 'shidduch';

-- ── 3. מדיניות INSERT ישירה: general בלבד ──────────────────────────
DROP POLICY IF EXISTS "rooms_insert_creator_canonical" ON public.chat_rooms;
CREATE POLICY "rooms_insert_creator_canonical" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND user_a < user_b
    AND user_a <> user_b
    AND ((SELECT auth.uid()) = user_a OR (SELECT auth.uid()) = user_b)
    AND context_kind = 'general'
    AND student_id IS NULL
    AND shidduch_id IS NULL
    AND context_label IS NULL
  );

-- ── 4. הרשאה לשרשור הצעה ───────────────────────────────────────────
-- true כש-p_user מנהל כרטיס של צד שההצעה נשלחה אליו (לפי recipient_scope).
-- פנימית: נקראת רק מתוך get_or_create_context_room.
CREATE OR REPLACE FUNCTION public.chat_user_owns_recipient_side(p_shidduch_id uuid, p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.shidduchim sh
    JOIN public.students s
      ON (s.id = sh.groom_id AND sh.recipient_scope IN ('both', 'groom_only'))
      OR (s.id = sh.bride_id AND sh.recipient_scope IN ('both', 'bride_only'))
    WHERE sh.id = p_shidduch_id
      AND sh.status <> 'draft'
      AND s.user_id = p_user
      AND s.deleted_at IS NULL
  );
$$;

ALTER FUNCTION public.chat_user_owns_recipient_side(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.chat_user_owns_recipient_side(uuid, uuid)
  IS 'פנימית: האם המשתמש מנהל כרטיס של צד שקיבל את ההצעה (לא טיוטה, בתוך recipient_scope).';

REVOKE ALL ON FUNCTION public.chat_user_owns_recipient_side(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_user_owns_recipient_side(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.chat_user_owns_recipient_side(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.chat_user_owns_recipient_side(uuid, uuid) TO service_role;

-- ── 5. עזרים פנימיים ───────────────────────────────────────────────
-- תווית שרשור הצעה: "שם המיועד ושם המיועדת" (צילום, גם אם אחד הכרטיסים נמחק)
CREATE OR REPLACE FUNCTION public.chat_shidduch_label(p_shidduch_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT COALESCE(NULLIF(BTRIM(COALESCE(g.first_name, '') || ' ' || COALESCE(g.last_name, '')), ''), 'המיועד')
         || ' ו' ||
         COALESCE(NULLIF(BTRIM(COALESCE(br.first_name, '') || ' ' || COALESCE(br.last_name, '')), ''), 'המיועדת')
  FROM public.shidduchim sh
  LEFT JOIN public.students g  ON g.id  = sh.groom_id
  LEFT JOIN public.students br ON br.id = sh.bride_id
  WHERE sh.id = p_shidduch_id;
$$;

ALTER FUNCTION public.chat_shidduch_label(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.chat_shidduch_label(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_shidduch_label(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.chat_shidduch_label(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.chat_shidduch_label(uuid) TO service_role;

-- מוצאת או יוצרת חדר לזוג + הקשר. בלי שום בדיקת הרשאה - הקורא אחראי עליה
-- (get_or_create_context_room, או הטריגר על תגובות להצעה).
CREATE OR REPLACE FUNCTION public.chat_find_or_create_room(
  p_creator     uuid,
  p_other       uuid,
  p_kind        text,
  p_student_id  uuid,
  p_shidduch_id uuid,
  p_label       text
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  a   uuid;
  b   uuid;
  rid uuid;
BEGIN
  SELECT cp.user_a, cp.user_b INTO a, b FROM public.chat_canonical_pair(p_creator, p_other) cp;

  -- יצירות מקבילות לאותו חדר: נעילה לפי זוג+הקשר, ואז בדיקה ויצירה
  PERFORM pg_advisory_xact_lock(
    hashtext('chat_room_context'),
    hashtext(a::text || b::text || p_kind
             || COALESCE(p_student_id::text, '') || COALESCE(p_shidduch_id::text, ''))
  );

  SELECT r.room_id INTO rid
  FROM public.chat_rooms r
  WHERE r.user_a = a AND r.user_b = b
    AND r.context_kind = p_kind
    AND (p_kind <> 'student'  OR r.student_id  = p_student_id)
    AND (p_kind <> 'shidduch' OR r.shidduch_id = p_shidduch_id);

  IF rid IS NOT NULL THEN
    RETURN rid;
  END IF;

  INSERT INTO public.chat_rooms (user_a, user_b, created_by, context_kind, student_id, shidduch_id, context_label)
  VALUES (a, b, p_creator, p_kind, p_student_id, p_shidduch_id, p_label)
  RETURNING room_id INTO rid;

  INSERT INTO public.chat_room_participants (room_id, user_id)
  VALUES (rid, p_creator), (rid, p_other);

  RETURN rid;
END;
$$;

ALTER FUNCTION public.chat_find_or_create_room(uuid, uuid, text, uuid, uuid, text) OWNER TO postgres;
COMMENT ON FUNCTION public.chat_find_or_create_room(uuid, uuid, text, uuid, uuid, text)
  IS 'פנימית: מוצאת או יוצרת חדר לפי זוג והקשר, בלי בדיקת הרשאה. הקורא אחראי עליה.';
REVOKE ALL ON FUNCTION public.chat_find_or_create_room(uuid, uuid, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chat_find_or_create_room(uuid, uuid, text, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.chat_find_or_create_room(uuid, uuid, text, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.chat_find_or_create_room(uuid, uuid, text, uuid, uuid, text) TO service_role;

-- ── 6. יצירת חדר עם הקשר ───────────────────────────────────────────
-- שגיאות (message): not_authenticated, invalid_other_user, invalid_context,
-- context_not_allowed. הלקוח לעולם אינו קובע את התווית - היא נגזרת כאן.
--
-- מכסת הפניות היומית: ראו enforce_shadchan_contact_limit_on_room למטה.
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

    IF NOT COALESCE(
      ((me = v_sh.shadchan_id OR public.is_admin(me))
         AND public.chat_user_owns_recipient_side(p_shidduch_id, other_user_id))
      OR ((other_user_id = v_sh.shadchan_id OR public.is_admin(other_user_id))
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

-- ── 7. get_or_create_dm_room: אותה חתימה, ממשיכה לפתוח שיחה כללית ───
-- ללא בדיקה נוספת, כמו היום (בדיוק כמו קריאה עם 'general').
CREATE OR REPLACE FUNCTION public.get_or_create_dm_room(other_user_id uuid) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.get_or_create_context_room(other_user_id, 'general', NULL, NULL);
$$;

-- ── 8. מכסת פניות: שרשורים נוספים עם אותו שדכן אינם פנייה חדשה ──────
-- הספירה היא של שדכנים שונים. כשכבר קיים בין השניים חדר כלשהו (כללי, כרטיס
-- או הצעה), פתיחת שרשור נוסף איננה פנייה לשדכן חדש ולכן אינה נספרת - כמו
-- שהמשך שיחה בחדר קיים אף פעם לא נספר. פנייה ראשונה לשדכן נספרת כרגיל,
-- ושרשור הצעה מול שדכן ששלח להורה הצעה פטור כבר ב-claim_shadchan_contact
-- (shadchanim_who_proposed_to_parent).
CREATE OR REPLACE FUNCTION public.enforce_shadchan_contact_limit_on_room() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_other uuid;
BEGIN
  v_other := CASE WHEN NEW.created_by = NEW.user_a THEN NEW.user_b ELSE NEW.user_a END;
  IF EXISTS (
    SELECT 1 FROM public.chat_rooms r
    WHERE r.user_a = NEW.user_a AND r.user_b = NEW.user_b
  ) THEN
    RETURN NEW;
  END IF;
  -- אותה הגדרת "שדכן" כמו ב-contact_shadchan (שדכן או מנהל)
  IF public.is_contactable_shadchan(v_other) THEN
    PERFORM public.claim_shadchan_contact(NEW.created_by, v_other);
  END IF;
  RETURN NEW;
END;
$$;

-- ── 9. הודעת תגובה להצעה נכנסת גם לשרשור ───────────────────────────
-- shidduch_responses שומרת רק תגובה נוכחית אחת לצד (נדרסת). כדי שהשרשור יהיה
-- התיעוד המלא, כל תגובה עם הודעה נכתבת גם כהודעת צ'אט בשרשור ההצעה, בשם הצד
-- שהגיב. זה טריגר על הטבלה ולא שינוי ב-respond_to_shidduch או בנתיבי ה-API,
-- ולכן אינו תלוי בהם.
--
-- ההרשאה כבר נבדקה ב-respond_to_shidduch (בעלות ונמענות), ולכן כאן אין
-- בדיקה נוספת. שדכן שהציע להורה הצעה פטור ממכסת הפניות. כשל כאן לא יפיל
-- את התגובה עצמה: הוא נרשם כאזהרה והתגובה נשמרת כרגיל.
--
-- תופעת לוואי מכוונת: הודעת הצ'אט מפעילה את notify_chat_message, כך שלשדכן
-- תגיע גם התראת צ'אט בנוסף להתראת התגובה.
CREATE OR REPLACE FUNCTION public.mirror_shidduch_response_to_thread() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_sh    public.shidduchim%ROWTYPE;
  v_room  uuid;
  v_label text;
BEGIN
  IF NEW.responder_id IS NULL OR NULLIF(BTRIM(NEW.message), '') IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.message IS NOT DISTINCT FROM OLD.message
     AND NEW.response IS NOT DISTINCT FROM OLD.response THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT * INTO v_sh FROM public.shidduchim WHERE id = NEW.shidduch_id;
    IF NOT FOUND OR v_sh.shadchan_id = NEW.responder_id THEN
      RETURN NEW;
    END IF;

    v_room := public.chat_find_or_create_room(
      NEW.responder_id, v_sh.shadchan_id, 'shidduch', NULL, NEW.shidduch_id,
      public.chat_shidduch_label(NEW.shidduch_id)
    );

    v_label := CASE NEW.response
      WHEN 'interested'       THEN 'מעוניינים'
      WHEN 'more_info_needed' THEN 'מבקשים מידע נוסף'
      WHEN 'rejected'         THEN 'לא מעוניינים'
      ELSE NEW.response
    END;

    INSERT INTO public.chat_messages (room_id, sender_id, content)
    VALUES (v_room, NEW.responder_id, 'תגובה להצעה: ' || v_label || E'\n' || BTRIM(NEW.message));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'mirror_shidduch_response_to_thread failed for shidduch %: % (%)',
      NEW.shidduch_id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.mirror_shidduch_response_to_thread() OWNER TO postgres;

COMMENT ON FUNCTION public.mirror_shidduch_response_to_thread()
  IS 'כותבת הודעת תגובה להצעה גם לשרשור הצ''אט של ההצעה, בשם הצד שהגיב. כשל אינו מפיל את התגובה.';

REVOKE ALL ON FUNCTION public.mirror_shidduch_response_to_thread() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mirror_shidduch_response_to_thread() FROM anon;
REVOKE ALL ON FUNCTION public.mirror_shidduch_response_to_thread() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mirror_shidduch_response_to_thread() TO service_role;

DROP TRIGGER IF EXISTS trigger_mirror_shidduch_response_to_thread ON public.shidduch_responses;
CREATE TRIGGER trigger_mirror_shidduch_response_to_thread
  AFTER INSERT OR UPDATE ON public.shidduch_responses
  FOR EACH ROW EXECUTE FUNCTION public.mirror_shidduch_response_to_thread();
