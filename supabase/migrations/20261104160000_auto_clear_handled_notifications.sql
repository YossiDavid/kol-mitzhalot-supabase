-- התראה שטופלה יורדת מהפעמון: כשהפריט שההתראה מבקשת לטפל בו טופל (כרטיס
-- אושר/נדחה, בקשת הצטרפות הוכרעה, בקשת צפייה בתמונה טופלה, דיווח טופל), כל
-- ההתראות הלא-נקראות עליו מסומנות כנקראו - אצל כל המנהלים. הפעמון מציג רק
-- התראות שלא נקראו, ולכן הן נעלמות גם למנהל שלא פתח אותן.

CREATE OR REPLACE FUNCTION public.clear_handled_notifications(
  p_related_id uuid,
  p_types text[]
)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.notifications
     SET read_at = now()
   WHERE related_id = p_related_id
     AND type = ANY (p_types)
     AND read_at IS NULL;
$function$;

ALTER FUNCTION public.clear_handled_notifications(uuid, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.clear_handled_notifications(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- כרטיס: אישור/דחייה מנקים "ממתין לאישור"; אישור צד שלישי מנקה "כרטיס צד שלישי"
CREATE OR REPLACE FUNCTION public.clear_card_review_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.admin_approved_at IS NOT NULL AND OLD.admin_approved_at IS NULL)
     OR (NEW.admin_rejected_at IS NOT NULL AND OLD.admin_rejected_at IS NULL)
     OR NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    PERFORM public.clear_handled_notifications(NEW.id, ARRAY['card_pending_approval']);
  END IF;
  IF (NEW.third_party_full_display_approved_at IS NOT NULL
        AND OLD.third_party_full_display_approved_at IS NULL)
     OR (NEW.third_party_proposals_approved_at IS NOT NULL
        AND OLD.third_party_proposals_approved_at IS NULL)
     OR NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    PERFORM public.clear_handled_notifications(NEW.id, ARRAY['third_party_card_created']);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_clear_card_review_notifications ON public.students;
CREATE TRIGGER trigger_clear_card_review_notifications
  AFTER UPDATE OF admin_approved_at, admin_rejected_at, deleted_at,
    third_party_full_display_approved_at, third_party_proposals_approved_at
  ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.clear_card_review_notifications();

-- בקשת הצטרפות (שדכן / איש צוות): יצאה מ"ממתין"
CREATE OR REPLACE FUNCTION public.clear_application_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.application_status IS NOT DISTINCT FROM 'pending'
     AND NEW.application_status IS DISTINCT FROM 'pending' THEN
    PERFORM public.clear_handled_notifications(NEW.id, ARRAY['application_submitted']);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_clear_application_notifications ON public.shadchanim_info;
CREATE TRIGGER trigger_clear_application_notifications
  AFTER UPDATE OF application_status ON public.shadchanim_info
  FOR EACH ROW EXECUTE FUNCTION public.clear_application_notifications();

DROP TRIGGER IF EXISTS trigger_clear_application_notifications ON public.staff_info;
CREATE TRIGGER trigger_clear_application_notifications
  AFTER UPDATE OF application_status ON public.staff_info
  FOR EACH ROW EXECUTE FUNCTION public.clear_application_notifications();

-- בקשת צפייה בתמונה / דיווח על כרטיס: יצאו מ"ממתין"
CREATE OR REPLACE FUNCTION public.clear_status_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- ממתין: pending בבקשות תמונה, open בדיווחים
  IF OLD.status::text IN ('pending', 'open')
     AND NEW.status::text NOT IN ('pending', 'open') THEN
    PERFORM public.clear_handled_notifications(NEW.id, TG_ARGV::text[]);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_clear_photo_request_notifications ON public.photo_view_requests;
CREATE TRIGGER trigger_clear_photo_request_notifications
  AFTER UPDATE OF status ON public.photo_view_requests
  FOR EACH ROW EXECUTE FUNCTION public.clear_status_notifications('photo_request_submitted');

DROP TRIGGER IF EXISTS trigger_clear_card_report_notifications ON public.card_reports;
CREATE TRIGGER trigger_clear_card_report_notifications
  AFTER UPDATE OF status ON public.card_reports
  FOR EACH ROW EXECUTE FUNCTION public.clear_status_notifications('card_report');

-- ניקוי חד-פעמי: התראות פתוחות על פריטים שכבר טופלו
UPDATE public.notifications n SET read_at = now()
 WHERE n.read_at IS NULL AND n.type = 'card_pending_approval'
   AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = n.related_id
               AND (s.admin_approved_at IS NOT NULL OR s.admin_rejected_at IS NOT NULL
                    OR s.deleted_at IS NOT NULL));
UPDATE public.notifications n SET read_at = now()
 WHERE n.read_at IS NULL AND n.type = 'application_submitted'
   AND (EXISTS (SELECT 1 FROM public.shadchanim_info si WHERE si.id = n.related_id
                AND si.application_status IS DISTINCT FROM 'pending')
     OR EXISTS (SELECT 1 FROM public.staff_info st WHERE st.id = n.related_id
                AND st.application_status IS DISTINCT FROM 'pending'));
UPDATE public.notifications n SET read_at = now()
 WHERE n.read_at IS NULL AND n.type = 'photo_request_submitted'
   AND EXISTS (SELECT 1 FROM public.photo_view_requests p WHERE p.id = n.related_id
               AND p.status::text <> 'pending');

-- ── rollback ─────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS trigger_clear_card_review_notifications ON public.students;
--   DROP TRIGGER IF EXISTS trigger_clear_application_notifications ON public.shadchanim_info;
--   DROP TRIGGER IF EXISTS trigger_clear_application_notifications ON public.staff_info;
--   DROP TRIGGER IF EXISTS trigger_clear_photo_request_notifications ON public.photo_view_requests;
--   DROP TRIGGER IF EXISTS trigger_clear_card_report_notifications ON public.card_reports;
--   DROP FUNCTION IF EXISTS public.clear_status_notifications(), public.clear_application_notifications(),
--     public.clear_card_review_notifications(), public.clear_handled_notifications(uuid, text[]);
