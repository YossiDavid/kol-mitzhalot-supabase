-- בקשות צפייה בתמונת מיועדת ("photo_view_requests").
--
-- רקע: תמונה של בת לעולם אינה נשלחת ללקוח (ראה buildPublicStudent ו-
-- canViewFemalePhoto ב-app/app/students/[id]/page.tsx) - השרת פשוט משמיט את
-- image_url. עד כה נקודת ההרחבה היחידה הייתה "מנהל בלבד", וכאן נוסף המסלול
-- השני: שדכן מבקש הרשאה נקודתית לכרטיס אחד, ומנהל מאשר או דוחה.
--
-- הבקשה היא לכרטיס ספציפי ולא הרשאה גורפת, ולכן המפתח הייחודי הוא
-- (requester_id, student_id): לשדכן יש לכל היותר בקשה אחת פר מיועדת, וכך
-- לחיצה חוזרת על התמונה הנעולה לא מייצרת עשר שורות ממתינות לאותו מנהל.
--
-- אידמפוטנטית - ניתן להריץ שוב על סביבה שכבר הוחלה עליה בלי שגיאה.

-- ── הטבלה ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.photo_view_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reason       text,
  decided_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, student_id)
);

COMMENT ON TABLE  public.photo_view_requests              IS 'בקשות של שדכנים לצפות בתמונת מיועדת, ואישור/דחייה של מנהל';
COMMENT ON COLUMN public.photo_view_requests.requester_id IS 'מי ביקש לראות את התמונה';
COMMENT ON COLUMN public.photo_view_requests.student_id   IS 'הכרטיס שאת תמונתו ביקשו לראות';
COMMENT ON COLUMN public.photo_view_requests.status       IS 'pending (ממתין), approved (אושר), rejected (נדחה)';
COMMENT ON COLUMN public.photo_view_requests.reason       IS 'נימוק חופשי שהמבקש כתב (אופציונלי) - נועד לעזור למנהל להחליט';
COMMENT ON COLUMN public.photo_view_requests.decided_by   IS 'המנהל שהכריע. ON DELETE SET NULL כדי שמחיקת מנהל לא תמחק את ההרשאה עצמה';
COMMENT ON COLUMN public.photo_view_requests.decided_at   IS 'מתי הוכרעה. נחתם על ידי טריגר ולא על ידי הלקוח';

-- מסך המנהל מסנן על status וממיין לפי created_at
CREATE INDEX IF NOT EXISTS idx_photo_view_requests_status_created_at
  ON public.photo_view_requests (status, created_at DESC);

-- can_view_student_photo ניגשת דרך (student_id, requester_id); המפתח הייחודי
-- מסודר הפוך (requester_id, student_id) ולכן לא משרת חיפוש לפי מיועדת בלבד.
CREATE INDEX IF NOT EXISTS idx_photo_view_requests_student_id
  ON public.photo_view_requests (student_id);

-- ── חתימת ההכרעה ──────────────────────────────────────────────────
-- decided_at/decided_by נחתמים בשרת ולא נשלחים מהלקוח: זהו רישום ביקורת
-- (audit) של מי אישר חשיפת תמונה, ולקוח לא אמור להיות מסוגל לזייף אותו או
-- לשכוח למלא אותו.
CREATE OR REPLACE FUNCTION public.stamp_photo_view_request_decision() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    NEW.decided_at := now();
    NEW.decided_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.stamp_photo_view_request_decision() OWNER TO postgres;

COMMENT ON FUNCTION public.stamp_photo_view_request_decision()
  IS 'חותם את מי הכריע ומתי, בשרת, כדי שרישום הביקורת לא יהיה תלוי בלקוח.';

DROP TRIGGER IF EXISTS trigger_stamp_photo_view_request_decision ON public.photo_view_requests;
CREATE TRIGGER trigger_stamp_photo_view_request_decision
  BEFORE UPDATE OF status ON public.photo_view_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_photo_view_request_decision();

-- ── פונקציית ההרשאה ───────────────────────────────────────────────
-- מקור אמת אחד לשאלה "האם למשתמש מותר לראות את תמונת המיועד/ת", כדי
-- שמסכי השרת, ה-RLS וכל קוד עתידי לא יגזרו כל אחד גרסה משלו.
-- SECURITY DEFINER כי היא קוראת את auth.users ואת students גם עבור מבקש
-- שמדיניות ה-RLS על students לא הייתה מחזירה לו את השורה.
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
        -- תמונת בן גלויה תמיד; הנעילה היא מאפיין של כרטיס בת בלבד
        s.gender = 'male'
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

ALTER FUNCTION public.can_view_student_photo(uuid, uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.can_view_student_photo(uuid, uuid)
  IS 'בודק אם משתמש רשאי לראות את תמונת המיועד/ת: בן, בעל הכרטיס, מנהל, או בעל בקשת צפייה מאושרת';

GRANT ALL ON FUNCTION public.can_view_student_photo(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.can_view_student_photo(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_view_student_photo(uuid, uuid) TO service_role;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.photo_view_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Photo_view_requests select own or admin" ON public.photo_view_requests;
CREATE POLICY "Photo_view_requests select own or admin" ON public.photo_view_requests
  FOR SELECT TO authenticated
  USING (requester_id = (SELECT auth.uid()) OR public.is_admin());

-- status = 'pending' הוא חלק מה-WITH CHECK ולא רק ברירת מחדל: בלעדיו מבקש
-- יכול היה להוסיף שורה משלו עם status = 'approved' ולהעניק לעצמו הרשאה.
DROP POLICY IF EXISTS "Photo_view_requests insert own pending" ON public.photo_view_requests;
CREATE POLICY "Photo_view_requests insert own pending" ON public.photo_view_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = (SELECT auth.uid()) AND status = 'pending');

-- ההכרעה שמורה למנהל בלבד - גם המבקש עצמו לא מעדכן את השורה שלו.
DROP POLICY IF EXISTS "Photo_view_requests update admin only" ON public.photo_view_requests;
CREATE POLICY "Photo_view_requests update admin only" ON public.photo_view_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Photo_view_requests delete admin only" ON public.photo_view_requests;
CREATE POLICY "Photo_view_requests delete admin only" ON public.photo_view_requests
  FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT ALL ON TABLE public.photo_view_requests TO anon;
GRANT ALL ON TABLE public.photo_view_requests TO authenticated;
GRANT ALL ON TABLE public.photo_view_requests TO service_role;

-- ── סוגי התראה חדשים ──────────────────────────────────────────────
-- ה-CHECK נבנה מחדש במלואו (ראה 20260908100000_notify_chat_message.sql) -
-- אין ALTER CONSTRAINT ל-CHECK, ולכן חובה לשמור כאן את כל הערכים הקיימים.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'shidduch_offer',
    'shidduch_response',
    'application_reviewed',
    'application_submitted',
    'chat_message',
    'photo_request_submitted',
    'photo_request_reviewed'
  ));

-- ── בקשה חדשה → כל המנהלים ───────────────────────────────────────
-- הבקשה נכתבת מהדפדפן תחת RLS ולא דרך route שרת, ולכן טריגר ולא קוד שרת -
-- בדיוק כמו notify_admins_application_submitted.
CREATE OR REPLACE FUNCTION public.notify_admins_photo_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_student text;
BEGIN
  SELECT NULLIF(BTRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), '')
  INTO v_student
  FROM public.students s WHERE s.id = NEW.student_id;

  -- כל המנהלים. התפקידים יושבים ב-raw_user_meta_data: מערך roles החדש,
  -- עם נפילה לשדה role הישן — בדיוק כמו public.has_role.
  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'photo_request_submitted',
    'בקשה חדשה לצפייה בתמונה',
    COALESCE('התקבלה בקשה לצפות בתמונה של ' || v_student || '.',
             'התקבלה בקשה לצפות בתמונת מיועדת.'),
    '/app/admin/photo-requests',
    NEW.id
  FROM auth.users u
  WHERE (u.raw_user_meta_data->'roles' ? 'admin')
     OR (u.raw_user_meta_data->>'role' = 'admin');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_photo_request() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_admins_photo_request()
  IS 'מתריע לכל המנהלים על בקשת צפייה בתמונה שממתינה להכרעה.';

DROP TRIGGER IF EXISTS trigger_notify_admins_photo_request ON public.photo_view_requests;
CREATE TRIGGER trigger_notify_admins_photo_request
  AFTER INSERT ON public.photo_view_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_photo_request();

-- ── הכרעה → המבקש ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_photo_request_reviewed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_title text;
  v_body  text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    v_title := 'בקשתך לצפייה בתמונה אושרה';
    v_body  := 'התמונה זמינה כעת בכרטיס המיועדת.';
  ELSE
    v_title := 'בקשתך לצפייה בתמונה נדחתה';
    v_body  := 'הבקשה נבדקה ולא אושרה.';
  END IF;

  PERFORM public.create_notification(
    NEW.requester_id, 'photo_request_reviewed',
    v_title, v_body,
    '/app/students/' || NEW.student_id::text
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_photo_request_reviewed() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_photo_request_reviewed()
  IS 'מתריע למבקש שבקשת הצפייה בתמונה אושרה או נדחתה.';

DROP TRIGGER IF EXISTS trigger_notify_photo_request_reviewed ON public.photo_view_requests;
CREATE TRIGGER trigger_notify_photo_request_reviewed
  AFTER UPDATE OF status ON public.photo_view_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_photo_request_reviewed();
