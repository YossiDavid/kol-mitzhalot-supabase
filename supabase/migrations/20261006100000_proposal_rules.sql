-- כללי הצעות: יומן שליחות, מכסת הצעות לכרטיס, השהיה (כולל נעילת מנהל)
-- ובחירת השדכן אם לשלוח את תמונת הבחור.
--
-- 1. shidduch_events - יומן append-only של כל שליחה לצד. טבלת shidduchim
--    לבדה היא היסטוריה מאבדת: צמד אחד = שורה אחת, שורה שנדחתה עוברת שימוש
--    חוזר (והשדכן והתאריכים נדרסים), ומחיקת הצעה היא מחיקה פיזית.
-- 2. מכסת הצעות לכרטיס (students.proposal_limit_*) - נקבעת ע"י מנהל הכרטיס.
-- 3. השהיה: in_shidduchim = false חוסם הצעות חדשות; admin_paused_* היא השהיה
--    של ההנהלה שמנהל הכרטיס אינו יכול לבטל.
-- 4. shidduchim.share_groom_photo - האם הצד של הכלה רואה את תמונות הבחור.
--
-- הכללים נאכפים גם ב-routes (הודעה ברורה, לפני שליחת המייל) וגם כאן
-- (טריגרים), כי ה-routes כותבים עם service role ועוקפים RLS.
--
-- אידמפוטנטית - ניתן להריץ שוב בלי שגיאה.

-- ── 1. עמודות חדשות ────────────────────────────────────────────────
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS proposal_limit_count  integer,
  ADD COLUMN IF NOT EXISTS proposal_limit_period text,
  ADD COLUMN IF NOT EXISTS admin_paused_at       timestamptz,
  ADD COLUMN IF NOT EXISTS admin_paused_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- תקרה סבירה (100) כדי שמספר מופרך לא יהפוך את המכסה ללא-מכסה בפועל
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_proposal_limit_count_check;
ALTER TABLE public.students ADD CONSTRAINT students_proposal_limit_count_check
  CHECK (proposal_limit_count IS NULL OR (proposal_limit_count > 0 AND proposal_limit_count <= 100));

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_proposal_limit_period_check;
ALTER TABLE public.students ADD CONSTRAINT students_proposal_limit_period_check
  CHECK (proposal_limit_period IS NULL OR proposal_limit_period IN ('day', 'week', 'month'));

-- מספר ותקופה באים יחד: מכסה בלי תקופה (או להפך) אינה מוגדרת
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_proposal_limit_pair_check;
ALTER TABLE public.students ADD CONSTRAINT students_proposal_limit_pair_check
  CHECK ((proposal_limit_count IS NULL) = (proposal_limit_period IS NULL));

COMMENT ON COLUMN public.students.proposal_limit_count  IS 'מכסת הצעות שהכרטיס מוכן לקבל בתקופה (proposal_limit_period). NULL = ללא הגבלה. נקבעת ע"י מנהל הכרטיס';
COMMENT ON COLUMN public.students.proposal_limit_period IS 'תקופת המכסה: day / week / month (חלון נע אחורה מרגע השליחה)';
COMMENT ON COLUMN public.students.admin_paused_at       IS 'מתי הנהלת המערכת השהתה את הכרטיס. כל עוד מוגדר, in_shidduchim נשאר false ומנהל הכרטיס אינו יכול לבטל';
COMMENT ON COLUMN public.students.admin_paused_by       IS 'המנהל שהשהה את הכרטיס';

ALTER TABLE public.shidduchim
  ADD COLUMN IF NOT EXISTS share_groom_photo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.shidduchim.share_groom_photo IS 'השדכן אישר שמנהלי כרטיס המיועדת יראו את תמונות הבחור. false = התמונות לא נטענות להם כלל';

-- ── 2. יומן השליחות ────────────────────────────────────────────────
-- בלי מפתחות זרים בכוונה: מחיקת הצעה, כרטיס או שדכן אסור שתמחק היסטוריה.
-- לכן גם שמות כ-snapshot - היומן קריא גם אחרי שהמקור נמחק.
CREATE TABLE IF NOT EXISTS public.shidduch_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shidduch_id        uuid NOT NULL,
  shadchan_id        uuid NOT NULL,
  -- הכרטיס שקיבל את ההצעה
  student_id         uuid NOT NULL,
  -- הכרטיס שהוצע לו
  other_student_id   uuid NOT NULL,
  -- הצד של הכרטיס המקבל בהצעה
  side               text NOT NULL CHECK (side IN ('groom', 'bride')),
  kind               text NOT NULL DEFAULT 'offer_sent' CHECK (kind IN ('offer_sent')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  shadchan_name      text,
  student_name       text,
  other_student_name text
);

COMMENT ON TABLE public.shidduch_events IS 'יומן append-only: שורה אחת לכל כרטיס שקיבל הצעה (שליחה ראשונה, שליחה חוזרת של שורה שנדחתה, או הרחבה לצד השני). נכתב רק ע"י טריגר על shidduchim';

CREATE INDEX IF NOT EXISTS idx_shidduch_events_student_created
  ON public.shidduch_events (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shidduch_events_shadchan_created
  ON public.shidduch_events (shadchan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shidduch_events_created
  ON public.shidduch_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shidduch_events_shidduch
  ON public.shidduch_events (shidduch_id);

ALTER TABLE public.shidduch_events ENABLE ROW LEVEL SECURITY;

-- קריאה למנהל בלבד. אין מדיניות כתיבה, ולכן אף לקוח לא כותב - רק הטריגר
-- (SECURITY DEFINER) ו-service role.
DROP POLICY IF EXISTS "Shidduch_events select admin only" ON public.shidduch_events;
CREATE POLICY "Shidduch_events select admin only" ON public.shidduch_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.shidduch_events FROM PUBLIC;
REVOKE ALL ON TABLE public.shidduch_events FROM anon;
REVOKE ALL ON TABLE public.shidduch_events FROM authenticated;
GRANT SELECT ON TABLE public.shidduch_events TO authenticated;
GRANT ALL ON TABLE public.shidduch_events TO service_role;

-- ── 3. מי קיבל הצעה חדשה ───────────────────────────────────────────
-- "הצדדים" שבהיקף הנתון.
CREATE OR REPLACE FUNCTION public.shidduch_scope_sides(p_scope text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE p_scope
    WHEN 'both'       THEN ARRAY['groom', 'bride']
    WHEN 'groom_only' THEN ARRAY['groom']
    WHEN 'bride_only' THEN ARRAY['bride']
    ELSE ARRAY[]::text[]
  END;
$$;

-- הצדדים שקיבלו את ההצעה *עכשיו*: ההיקף החדש פחות מה שכבר נשלח.
-- "כבר נשלח" = היה sent_at בשורה הקודמת וגם בחדשה. שורה שנדחתה ונשלחת שוב
-- עוברת דרך sent_at = NULL (ראו offer/route.ts), ולכן נחשבת שליחה מלאה.
CREATE OR REPLACE FUNCTION public.shidduch_new_receiving_sides(
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
    CASE WHEN p_new_status IN ('draft', 'rejected') THEN ARRAY[]::text[]
         ELSE public.shidduch_scope_sides(p_new_scope) END
  ) AS side
  WHERE NOT (
    p_old_sent_at IS NOT NULL
    AND p_new_sent_at IS NOT NULL
    AND side = ANY (public.shidduch_scope_sides(p_old_scope))
  );
$$;

-- ── 4. מכסה והשהיה של כרטיס ────────────────────────────────────────
-- מקור אמת אחד גם ל-route (הודעה למשתמש) וגם לטריגר (אכיפה).
-- החלון נע: ספירת אירועים מ-now() - התקופה. retry_at = מתי יוצא מהחלון
-- האירוע שמשחרר מקום (הישן ביותר כשהמכסה בדיוק מלאה).
CREATE OR REPLACE FUNCTION public.student_proposal_quota(p_student_id uuid)
RETURNS TABLE (
  is_paused    boolean,
  limit_count  integer,
  limit_period text,
  used_count   integer,
  retry_at     timestamptz
)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_student  record;
  v_window   interval;
  v_used     integer := 0;
  v_retry    timestamptz := NULL;
BEGIN
  SELECT s.in_shidduchim, s.admin_paused_at, s.proposal_limit_count, s.proposal_limit_period
    INTO v_student
    FROM public.students s
   WHERE s.id = p_student_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_student.proposal_limit_count IS NOT NULL THEN
    v_window := CASE v_student.proposal_limit_period
      WHEN 'day'   THEN interval '1 day'
      WHEN 'week'  THEN interval '7 days'
      ELSE interval '1 month'
    END;

    SELECT count(*)::integer INTO v_used
      FROM public.shidduch_events e
     WHERE e.student_id = p_student_id
       AND e.created_at > now() - v_window;

    IF v_used >= v_student.proposal_limit_count THEN
      SELECT e.created_at + v_window INTO v_retry
        FROM public.shidduch_events e
       WHERE e.student_id = p_student_id
         AND e.created_at > now() - v_window
       ORDER BY e.created_at ASC
      OFFSET (v_used - v_student.proposal_limit_count)
       LIMIT 1;
    END IF;
  END IF;

  is_paused    := v_student.in_shidduchim IS NOT DISTINCT FROM false
                  OR v_student.admin_paused_at IS NOT NULL;
  limit_count  := v_student.proposal_limit_count;
  limit_period := v_student.proposal_limit_period;
  used_count   := v_used;
  retry_at     := v_retry;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.student_proposal_quota(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.student_proposal_quota(uuid)
  IS 'מצב קבלת הצעות של כרטיס: מושהה?, המכסה, כמה נוצלו בחלון הנע, ומתי ישתחרר מקום';

REVOKE ALL ON FUNCTION public.student_proposal_quota(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.student_proposal_quota(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.student_proposal_quota(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.student_proposal_quota(uuid) TO service_role;

-- ── 5. אכיפה על shidduchim (BEFORE) ────────────────────────────────
-- חוסם הצעה *חדשה* לכרטיס מושהה או כזה שמיצה את המכסה. הצעות קיימות לא
-- נבדקות: שינוי סטטוס, הערות ותגובות אינם "קבלת הצעה".
--
-- מתי שורה "מקבלת הצעה חדשה" (שני שלבי ה-route):
--   * שלב ראשון: INSERT או מעבר מ-draft/rejected, עם sent_at = NULL.
--   * הרחבה לצד השני: sent_at כבר קיים והיקף ההצעה גדל.
-- השלמת השליחה (sent_at: NULL -> ערך) אינה נבדקת: השלב הראשון כבר אושר
-- והמייל כבר יצא, וחסימה שם הייתה משאירה שורה תקועה אחרי מייל שנשלח.
CREATE OR REPLACE FUNCTION public.enforce_shidduch_card_gates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_sides    text[];
  v_side     text;
  v_student  uuid;
  v_quota    record;
  v_is_first_phase boolean;
  v_is_completion  boolean;
BEGIN
  IF NEW.recipient_scope IS NULL OR NEW.status::text IN ('draft', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_is_completion := TG_OP = 'UPDATE' AND OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL;
  IF v_is_completion THEN
    RETURN NEW;
  END IF;

  v_is_first_phase := NEW.sent_at IS NULL
    AND (TG_OP = 'INSERT' OR OLD.status::text IN ('draft', 'rejected'));

  IF NEW.sent_at IS NULL AND NOT v_is_first_phase THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_sides := public.shidduch_new_receiving_sides(NULL, NULL, NEW.status::text, NEW.sent_at, NEW.recipient_scope);
  ELSE
    v_sides := public.shidduch_new_receiving_sides(OLD.sent_at, OLD.recipient_scope, NEW.status::text, NEW.sent_at, NEW.recipient_scope);
  END IF;

  FOREACH v_side IN ARRAY v_sides LOOP
    v_student := CASE v_side WHEN 'groom' THEN NEW.groom_id ELSE NEW.bride_id END;

    SELECT * INTO v_quota FROM public.student_proposal_quota(v_student);
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_quota.is_paused THEN
      RAISE EXCEPTION 'card_paused' USING ERRCODE = 'P0001', DETAIL = v_side;
    END IF;

    IF v_quota.limit_count IS NOT NULL AND v_quota.used_count >= v_quota.limit_count THEN
      RAISE EXCEPTION 'proposal_limit_reached' USING ERRCODE = 'P0001', DETAIL = v_side;
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

-- ── 6. כתיבה ליומן (AFTER) ─────────────────────────────────────────
-- נכתב כשה-sent_at נקבע (סוף השליחה, אחרי שהמייל יצא) או כשההיקף גדל.
-- שורה אחת בדיוק לכל כרטיס שקיבל את ההצעה עכשיו.
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
BEGIN
  IF NEW.sent_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at
     AND NEW.recipient_scope IS NOT DISTINCT FROM OLD.recipient_scope THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_sides := public.shidduch_new_receiving_sides(NULL, NULL, NEW.status::text, NEW.sent_at, NEW.recipient_scope);
  ELSE
    v_sides := public.shidduch_new_receiving_sides(OLD.sent_at, OLD.recipient_scope, NEW.status::text, NEW.sent_at, NEW.recipient_scope);
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

DROP TRIGGER IF EXISTS trigger_log_shidduch_events ON public.shidduchim;
CREATE TRIGGER trigger_log_shidduch_events
  AFTER INSERT OR UPDATE OF sent_at, recipient_scope ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.log_shidduch_events();

-- ── 7. השלמה רטרואקטיבית מהצעות קיימות ─────────────────────────────
-- כולל הצעות שנדחתה: הצד קיבל אותן. שורה בלי sent_at (ישנה) מתוארכת לפי
-- created_at. שורה בלי recipient_scope אינה מוצגת לאיש (ראו shidduch_reveals_student)
-- ולכן לא נספרת. אידמפוטנטי: שידוך שכבר יש לו אירוע לא נוגעים בו.
INSERT INTO public.shidduch_events (
  shidduch_id, shadchan_id, student_id, other_student_id, side, kind,
  created_at, shadchan_name, student_name, other_student_name
)
SELECT
  sh.id, sh.shadchan_id,
  CASE side WHEN 'groom' THEN sh.groom_id ELSE sh.bride_id END,
  CASE side WHEN 'groom' THEN sh.bride_id ELSE sh.groom_id END,
  side, 'offer_sent',
  COALESCE(sh.sent_at, sh.created_at),
  COALESCE(
    NULLIF(btrim(COALESCE(u.raw_user_meta_data->>'firstName', '') || ' ' || COALESCE(u.raw_user_meta_data->>'lastName', '')), ''),
    u.email),
  CASE side WHEN 'groom' THEN btrim(g.first_name || ' ' || g.last_name) ELSE btrim(b.first_name || ' ' || b.last_name) END,
  CASE side WHEN 'groom' THEN btrim(b.first_name || ' ' || b.last_name) ELSE btrim(g.first_name || ' ' || g.last_name) END
FROM public.shidduchim sh
CROSS JOIN LATERAL unnest(public.shidduch_scope_sides(sh.recipient_scope)) AS side
LEFT JOIN auth.users u ON u.id = sh.shadchan_id
LEFT JOIN public.students g ON g.id = sh.groom_id
LEFT JOIN public.students b ON b.id = sh.bride_id
WHERE sh.status::text <> 'draft'
  AND sh.recipient_scope IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.shidduch_events e WHERE e.shidduch_id = sh.id);

-- ── 8. השהיית מנהל: נעילה ב-DB ─────────────────────────────────────
-- מנהל הכרטיס מעדכן את students ישירות תחת RLS, ולכן ה-UI לבדו אינו אכיפה.
--   * כל עוד admin_paused_at מוגדר, in_shidduchim נשאר false - לכל כותב,
--     גם ל-route של שינוי סטטוס וגם ל-RPC של עריכת הכרטיס (שמאפס אותו ל-true).
--   * רק מנהל (או service role / auth.uid() ריק) משנה את admin_paused_*.
CREATE OR REPLACE FUNCTION public.enforce_student_admin_pause() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_trusted boolean := auth.uid() IS NULL OR public.is_admin();
BEGIN
  IF NOT v_is_trusted THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.admin_paused_at IS NOT NULL OR NEW.admin_paused_by IS NOT NULL THEN
        RAISE EXCEPTION 'admin_pause_forbidden' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.admin_paused_at IS DISTINCT FROM OLD.admin_paused_at
       OR NEW.admin_paused_by IS DISTINCT FROM OLD.admin_paused_by THEN
      RAISE EXCEPTION 'admin_pause_forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.admin_paused_at IS NOT NULL THEN
    NEW.in_shidduchim := false;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_student_admin_pause() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_enforce_student_admin_pause ON public.students;
CREATE TRIGGER trigger_enforce_student_admin_pause
  BEFORE INSERT OR UPDATE OF in_shidduchim, admin_paused_at, admin_paused_by ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_admin_pause();

-- ── 9. תמונת הבחור ─────────────────────────────────────────────────
-- "מוסתרת" רק לצופה שהגיע לכרטיס אך ורק דרך הצעה (לא בעלים, שדכן, מנהל או
-- איש צוות), וכל ההצעות שמקשרות אותו לבחור כבויות. מספיקה הצעה אחת עם
-- share_groom_photo כדי לחשוף. צופה אנונימי (קישור שיתוף) אינו מושפע.
CREATE OR REPLACE FUNCTION public.groom_photo_withheld(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT uid IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.students g
      WHERE g.id = sid AND g.gender = 'male' AND g.deleted_at IS NULL
        AND g.user_id IS DISTINCT FROM uid
    )
    AND NOT public.has_role(uid, 'admin')
    AND NOT public.has_role(uid, 'shadchan')
    AND NOT public.staff_can_access_student(uid, sid)
    AND EXISTS (
      SELECT 1
      FROM public.shidduchim sh
      JOIN public.students me ON me.user_id = uid AND me.deleted_at IS NULL
      WHERE sh.groom_id = sid
        AND me.id = sh.bride_id
        AND sh.status <> 'draft'
        AND sh.recipient_scope IN ('both', 'bride_only')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.shidduchim sh
      JOIN public.students me ON me.user_id = uid AND me.deleted_at IS NULL
      WHERE sh.groom_id = sid
        AND me.id = sh.bride_id
        AND sh.status <> 'draft'
        AND sh.recipient_scope IN ('both', 'bride_only')
        AND sh.share_groom_photo
    );
$$;

ALTER FUNCTION public.groom_photo_withheld(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.groom_photo_withheld(uuid, uuid)
  IS 'האם תמונות הבחור מוסתרות מהצופה: הגיע אליו רק דרך הצעה ואף הצעה לא סימנה share_groom_photo';

-- עם uid מפורש: לשימוש פנימי (can_view_student_photo) ו-service role בלבד,
-- כדי שלקוח לא יחקור דרכה את ההצעות של משתמש אחר
REVOKE ALL ON FUNCTION public.groom_photo_withheld(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.groom_photo_withheld(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.groom_photo_withheld(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.groom_photo_withheld(uuid, uuid) TO service_role;

-- גרסה לצופה המחובר, בקריאה אחת לרשימה
CREATE OR REPLACE FUNCTION public.withheld_groom_photo_ids(p_student_ids uuid[]) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT sid
  FROM unnest(p_student_ids) AS sid
  WHERE public.groom_photo_withheld(auth.uid(), sid);
$$;

ALTER FUNCTION public.withheld_groom_photo_ids(uuid[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.withheld_groom_photo_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withheld_groom_photo_ids(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.withheld_groom_photo_ids(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withheld_groom_photo_ids(uuid[]) TO service_role;

-- אותה פונקציית הרשאה כמו ב-20260908140000, עם תנאי אחד נוסף בענף הבן
CREATE OR REPLACE FUNCTION public.can_view_student_photo(uid uuid, sid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = sid
      AND s.deleted_at IS NULL
      AND (
        -- תמונת בן גלויה, אלא אם הצופה הגיע אליו רק דרך הצעה והשדכן לא שיתף
        (s.gender = 'male' AND NOT public.groom_photo_withheld(uid, s.id))
        -- בעל הכרטיס (ההורה שיצר אותו) רואה את התמונה שהוא עצמו העלה
        OR s.user_id = uid
        OR public.has_role(uid, 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.photo_view_requests r
          WHERE r.student_id = s.id
            AND r.requester_id = uid
            AND r.status = 'approved'
        )
      )
  );
$$;
