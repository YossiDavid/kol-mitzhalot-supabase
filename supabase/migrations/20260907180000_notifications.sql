-- התראות אמיתיות במקום חמש ההתראות הפיקטיביות שהיו מקודדות בהדר.
--
-- למה טריגרים ולא הוספה מקוד ה-routes: חלק מהאירועים נכתבים מהדפדפן
-- תחת RLS ולא דרך API (הגשת בקשת שדכן/צוות נכתבת מ-app/app/settings),
-- ולכן אין שם קוד שרת לתלות בו. טריגר עובד בכל המסלולים ואינו ניתן
-- לעקיפה.
--
-- אידמפוטנטית — ניתן להריץ שוב.

-- ── הטבלה ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN (
               'shidduch_offer',
               'shidduch_response',
               'application_reviewed'
             )),
  title      text NOT NULL,
  body       text,
  link       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- חותמת ולא בוליאני, בעקבות approved_at/rejected_at ו-last_read_at
  read_at    timestamptz
);

COMMENT ON TABLE  public.notifications         IS 'התראות למשתמש. נכתבות רק על ידי טריגרים, ולא ישירות מהלקוח.';
COMMENT ON COLUMN public.notifications.user_id IS 'מקבל ההתראה';
COMMENT ON COLUMN public.notifications.type    IS 'סוג האירוע שיצר את ההתראה';
COMMENT ON COLUMN public.notifications.link    IS 'נתיב פנימי לפתיחה בלחיצה';
COMMENT ON COLUMN public.notifications.read_at IS 'מתי נקראה. NULL = חדשה, וזה מה שמדליק את הנקודה האדומה.';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
  ON public.notifications (user_id, created_at DESC);

-- אינדקס חלקי: שאילתת הנקודה האדומה תמיד מסננת על שלא נקראו
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- אין מדיניות INSERT ללקוח בכוונה: כתיבה רק דרך הטריגרים
-- (SECURITY DEFINER), כדי שמשתמש לא ייצר לעצמו או לאחרים התראות.
DROP POLICY IF EXISTS "Notifications select own or admin" ON public.notifications;
CREATE POLICY "Notifications select own or admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- WITH CHECK תואם ל-USING כדי שסימון כנקרא לא יוכל להעביר התראה
-- למשתמש אחר.
DROP POLICY IF EXISTS "Notifications update own" ON public.notifications;
CREATE POLICY "Notifications update own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Notifications delete own or admin" ON public.notifications;
CREATE POLICY "Notifications delete own or admin" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin());

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

-- ── עוזר כתיבה ────────────────────────────────────────────────────
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
  WHERE p_user_id IS NOT NULL;
$$;

ALTER FUNCTION public.create_notification(uuid, text, text, text, text) OWNER TO postgres;
COMMENT ON FUNCTION public.create_notification(uuid, text, text, text, text)
  IS 'יוצר התראה. מתעלם בשקט מנמען חסר, כדי שטריגר לא ייפול על שידוך בלי בעלים.';

GRANT ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.create_notification(uuid, text, text, text, text) TO service_role;

-- ── 1. הצעת שידוך נשלחה → ההורים ─────────────────────────────────
-- התנאי הוא sent_at שעובר מ-NULL לערך, ולא status = 'sent'.
-- app/api/v1/shidduchim/offer/route.ts מגלגל את השורה אחורה אם המייל
-- נכשל, ולכן status נקבע לפני שידוע אם ההצעה באמת יצאה.
CREATE OR REPLACE FUNCTION public.notify_shidduch_offer_sent() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_scope      text;
  v_groom_user uuid;
  v_bride_user uuid;
BEGIN
  IF NEW.sent_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_scope := COALESCE(NEW.recipient_scope, 'both');

  SELECT user_id INTO v_groom_user FROM public.students WHERE id = NEW.groom_id;
  SELECT user_id INTO v_bride_user FROM public.students WHERE id = NEW.bride_id;

  IF v_scope IN ('both', 'groom_only') THEN
    PERFORM public.create_notification(
      v_groom_user, 'shidduch_offer',
      'הצעת שידוך חדשה',
      'התקבלה עבורכם הצעת שידוך חדשה.',
      '/app/proposals'
    );
  END IF;

  IF v_scope IN ('both', 'bride_only') THEN
    PERFORM public.create_notification(
      v_bride_user, 'shidduch_offer',
      'הצעת שידוך חדשה',
      'התקבלה עבורכם הצעת שידוך חדשה.',
      '/app/proposals'
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_shidduch_offer_sent() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_shidduch_offer_sent ON public.shidduchim;
CREATE TRIGGER trigger_notify_shidduch_offer_sent
  AFTER INSERT OR UPDATE OF sent_at ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.notify_shidduch_offer_sent();

-- ── 2. ההורה הגיב להצעה → השדכן ──────────────────────────────────
-- ל-shidduchim אין טריגר updated_at, וה-routes קובעים אותו מ-JS,
-- ולכן משווים את הסטטוס עצמו ולא חותמת זמן.
CREATE OR REPLACE FUNCTION public.notify_shidduch_response() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_label text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_label := CASE NEW.status::text
    WHEN 'interested'       THEN 'יש עניין בהצעה'
    WHEN 'more_info_needed' THEN 'התבקש מידע נוסף'
    WHEN 'rejected'         THEN 'ההצעה נדחתה'
    ELSE NULL
  END;

  IF v_label IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.shadchan_id, 'shidduch_response',
    v_label,
    'התקבלה תגובה להצעת שידוך ששלחת.',
    '/app/canvas'
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_shidduch_response() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_shidduch_response ON public.shidduchim;
CREATE TRIGGER trigger_notify_shidduch_response
  AFTER UPDATE OF status ON public.shidduchim
  FOR EACH ROW EXECUTE FUNCTION public.notify_shidduch_response();

-- ── 3. בקשת שדכן/צוות אושרה או נדחתה → המבקש ─────────────────────
-- פונקציה אחת לשתי הטבלאות; שתיהן נושאות user_id ו-application_status.
CREATE OR REPLACE FUNCTION public.notify_application_reviewed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_kind  text;
  v_title text;
BEGIN
  IF OLD.application_status IS NOT DISTINCT FROM NEW.application_status THEN
    RETURN NEW;
  END IF;
  IF NEW.application_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_kind := CASE TG_TABLE_NAME
    WHEN 'shadchanim_info' THEN 'שדכן'
    ELSE 'איש צוות'
  END;

  v_title := CASE NEW.application_status
    WHEN 'approved' THEN 'בקשתך כ' || v_kind || ' אושרה'
    ELSE 'בקשתך כ' || v_kind || ' נדחתה'
  END;

  PERFORM public.create_notification(
    NEW.user_id, 'application_reviewed',
    v_title,
    COALESCE(NEW.rejected_reason, 'ניתן לראות את הפרטים בהגדרות.'),
    '/app/settings'
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_application_reviewed() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_notify_shadchan_application ON public.shadchanim_info;
CREATE TRIGGER trigger_notify_shadchan_application
  AFTER UPDATE OF application_status ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_reviewed();

DROP TRIGGER IF EXISTS trigger_notify_staff_application ON public.staff_info;
CREATE TRIGGER trigger_notify_staff_application
  AFTER UPDATE OF application_status ON public.staff_info
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_reviewed();

-- ── Realtime ──────────────────────────────────────────────────────
-- ADD TABLE אינו אידמפוטנטי ונופל ב-42710 אם הטבלה כבר בפרסום.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$do$;
