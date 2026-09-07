-- בקשת הצטרפות חדשה (שדכן או איש צוות) צריכה להופיע בהתראות של
-- המנהלים. עד כה notify_application_reviewed הודיעה למבקש על אישור
-- או דחייה, אבל אף אחד לא ידע שהגיעה בקשה.
--
-- הבקשות נכתבות מהדפדפן ב-upsert (app/app/settings/*), ולכן שוב
-- טריגר ולא קוד שרת.
--
-- אידמפוטנטית — ניתן להריץ שוב.

-- ── סוג התראה חדש ─────────────────────────────────────────────────
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'shidduch_offer',
    'shidduch_response',
    'application_reviewed',
    'application_submitted'
  ));

-- ── בקשה חדשה → כל המנהלים ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_application_submitted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_kind text;
  v_link text;
BEGIN
  IF NEW.application_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  -- בעדכון: רק מעבר אמיתי ל-pending. הטופס עושה upsert, ושמירה
  -- חוזרת של בקשה שכבר ממתינה לא אמורה להתריע שוב.
  IF TG_OP = 'UPDATE' AND OLD.application_status IS NOT DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'shadchanim_info' THEN
    v_kind := 'שדכן';
    v_link := '/app/admin/shadchanim/requests';
  ELSE
    v_kind := 'איש צוות';
    v_link := '/app/admin/staff/requests';
  END IF;

  -- כל המנהלים. התפקידים יושבים ב-raw_user_meta_data: מערך roles
  -- החדש, עם נפילה לשדה role הישן — בדיוק כמו public.has_role.
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT
    u.id,
    'application_submitted',
    'בקשת הצטרפות חדשה כ' || v_kind,
    'התקבלה בקשה חדשה הממתינה לבדיקה.',
    v_link
  FROM auth.users u
  WHERE (u.raw_user_meta_data->'roles' ? 'admin')
     OR (u.raw_user_meta_data->>'role' = 'admin');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_application_submitted() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_admins_application_submitted()
  IS 'מתריע לכל המנהלים על בקשת הצטרפות חדשה שממתינה לבדיקה.';

DROP TRIGGER IF EXISTS trigger_notify_admins_shadchan_application ON public.shadchanim_info;
CREATE TRIGGER trigger_notify_admins_shadchan_application
  AFTER INSERT OR UPDATE OF application_status ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_application_submitted();

DROP TRIGGER IF EXISTS trigger_notify_admins_staff_application ON public.staff_info;
CREATE TRIGGER trigger_notify_admins_staff_application
  AFTER INSERT OR UPDATE OF application_status ON public.staff_info
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_application_submitted();
