-- דחייה או החזרה להמתנה של כרטיס בלי הודעה לבעליו (תוספת בלבד, בטוח להחיל
-- לפני הקוד).
--
-- students.admin_review_silent נכתב יחד עם עמודות האישור, באותו עדכון, בנתיב
-- המנהל (PATCH /api/v1/students/:id/approval):
--   - דחייה עם "ללא שליחת הודעה לבעל הכרטיס": true - אין התראה בפעמון
--     (notify_owner_card_reviewed), ואין מייל (הנתיב אינו שולח).
--   - החזרה להמתנה (reset) של כרטיס שנדחה: true - אין התראה "נשלח לאישור
--     מחדש" למנהלים (notify_admins_card_pending_approval): זו פעולה של מנהל,
--     ולא תיקון של בעל הכרטיס. גם לבעל הכרטיס אין הודעה.
--   - אישור ודחייה רגילה: false. שליחה לאישור מחדש של בעל הכרטיס: false.
-- קוד ישן אינו כותב את העמודה: ברירת המחדל false, וההתראות כמו היום. בשליחה
-- לאישור מחדש קוד ישן משאיר ערך true מדחייה שקטה - ואז המנהלים אינם מקבלים
-- התראה; הקוד החדש מאפס אותה.
-- גופי הפונקציות מ-20261019090000_card_admin_approval.sql; התוספת מסומנת "חדש".
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admin_review_silent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.students.admin_review_silent IS
  'ההכרעה האחרונה של המנהל (דחייה / החזרה להמתנה) נעשתה בלי הודעה לבעל הכרטיס ובלי התראה למנהלים';

CREATE OR REPLACE FUNCTION public.notify_admins_card_pending_approval() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_is_resubmission boolean := false;
BEGIN
  IF NEW.admin_approved_at IS NOT NULL OR NEW.admin_rejected_at IS NOT NULL
     OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.card_for IS NOT DISTINCT FROM 'other' THEN
      RETURN NEW;
    END IF;
  ELSE
    v_is_resubmission := OLD.admin_rejected_at IS NOT NULL;
    -- חדש: מנהל החזיר את הכרטיס להמתנה - אין התראה
    IF NOT v_is_resubmission OR NEW.admin_review_silent THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'card_pending_approval',
    CASE WHEN v_is_resubmission
         THEN 'כרטיס נשלח לאישור מחדש'
         ELSE 'כרטיס חדש ממתין לאישור' END,
    'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
      || CASE WHEN v_is_resubmission
              THEN ' תוקן ונשלח שוב לאישור הנהלת המערכת.'
              ELSE ' ממתין לאישור הנהלת המערכת.' END,
    '/app/admin/new-cards',
    NEW.id
  FROM auth.users u
  WHERE public.has_role(u.id, 'admin');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_card_pending_approval() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_admins_card_pending_approval() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_owner_card_reviewed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_approved_at IS NOT NULL AND OLD.admin_approved_at IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      NEW.user_id,
      'card_approved',
      'הכרטיס אושר',
      'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
        || ' אושר על ידי הנהלת המערכת, ומעכשיו הוא מוצג לשדכנים.',
      '/app/students/' || NEW.id,
      NEW.id
    );
  -- חדש: דחייה שקטה - בלי התראה לבעל הכרטיס
  ELSIF NEW.admin_rejected_at IS NOT NULL AND OLD.admin_rejected_at IS NULL
        AND NOT NEW.admin_review_silent THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    VALUES (
      NEW.user_id,
      'card_rejected',
      'הכרטיס לא אושר',
      'הכרטיס של ' || NEW.first_name || ' ' || NEW.last_name
        || ' לא אושר על ידי הנהלת המערכת. אפשר לתקן את הכרטיס ולשלוח אותו'
        || ' לאישור מחדש. הסיבה שצוינה: ' || COALESCE(NEW.admin_rejection_reason, ''),
      '/app/students/' || NEW.id,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_owner_card_reviewed() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.notify_owner_card_reviewed() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
--   -- להריץ שוב את שתי הפונקציות מתוך 20261019090000_card_admin_approval.sql, ואז:
--   ALTER TABLE public.students DROP COLUMN IF EXISTS admin_review_silent;
--   NOTIFY pgrst, 'reload schema';
