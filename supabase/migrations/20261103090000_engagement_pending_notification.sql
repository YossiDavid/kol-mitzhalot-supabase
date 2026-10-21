-- מודעת מאורסים ממתינה לפרסום: כשנוצרת מודעה שלא פורסמה (סגירת שידוך
-- במערכת, או טופס "עדכון מודעת מאורסים" מהאתר) - כל המנהלים מקבלים התראה
-- עם קישור לניהול המודעות, כדי לפרסם אותה באתר בזמן. מודעה שהמנהל עצמו
-- מוסיף (source = 'admin') לא שולחת התראה.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. סוג ההתראה ─────────────────────────────────────────────────
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
    'proposal_disclosure_opened'::text,
    'card_updated'::text, 'card_photos_changed'::text,
    'admin_announcement'::text,
    -- חדש
    'engagement_pending'::text
  ]));

-- ── 2. ההתראה למנהלים ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admins_engagement_pending() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF NEW.is_published IS TRUE OR NEW.source IS NOT DISTINCT FROM 'admin' THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    SELECT u.id,
           'engagement_pending',
           'מודעת מאורסים ממתינה לפרסום',
           NEW.groom_name || ' ו' || NEW.bride_name
             || CASE WHEN NEW.source = 'system' THEN ' - שידוך שנסגר במערכת'
                     ELSE ' - נשלחה מהאתר' END,
           '/app/admin/content/engagements',
           NEW.id
      FROM auth.users u
     WHERE public.has_role(u.id, 'admin');
  EXCEPTION WHEN OTHERS THEN
    -- כשל בהתראה לא מבטל את יצירת המודעה
    RAISE WARNING 'notify_admins_engagement_pending failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_engagement_pending() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_admins_engagement_pending() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_engagement_pending() FROM anon;
REVOKE ALL ON FUNCTION public.notify_admins_engagement_pending() FROM authenticated;

DROP TRIGGER IF EXISTS trigger_notify_admins_engagement_pending ON public.engagements;
CREATE TRIGGER trigger_notify_admins_engagement_pending
  AFTER INSERT ON public.engagements
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_engagement_pending();

-- ── Rollback (להריץ ידנית) ──
-- DROP TRIGGER IF EXISTS trigger_notify_admins_engagement_pending ON public.engagements;
-- DROP FUNCTION IF EXISTS public.notify_admins_engagement_pending();
-- ולהחזיר את notifications_type_check מ-20261102200000_shadchan_announcements.sql
