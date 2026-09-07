-- בקשות הצטרפות שהוגשו לפני שהטריגר נוצר לא הפיקו התראה, ולכן
-- מנהל שרואה בקשה ממתינה במסך הבדיקה לא רואה אותה בפעמון.
-- טריגר פועל רק על אירועים חדשים; רשומות היסטוריות דורשות backfill.
--
-- כדי שה-backfill יהיה אידמפוטנטי צריך לדעת איזו בקשה יצרה איזו
-- התראה. עד כה לא היה קשר כזה, ולכן נוספת related_id.
--
-- אידמפוטנטית — ניתן להריץ שוב.

-- ── קישור התראה לרשומת המקור ─────────────────────────────────────
-- בלי FK: המזהה מצביע על shadchanim_info או על staff_info לפי הסוג,
-- ואין דרך לנסח FK יחיד לשתי טבלאות.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_id uuid;

COMMENT ON COLUMN public.notifications.related_id
  IS 'מזהה הרשומה שיצרה את ההתראה. משמש למניעת כפילות; אין FK כי המקור משתנה לפי type.';

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_related
  ON public.notifications (user_id, type, related_id);

-- ── הטריגר ממלא מעכשיו גם את related_id ──────────────────────────
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

  INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
  SELECT
    u.id,
    'application_submitted',
    'בקשת הצטרפות חדשה כ' || v_kind,
    'התקבלה בקשה חדשה הממתינה לבדיקה.',
    v_link,
    NEW.id
  FROM auth.users u
  WHERE (u.raw_user_meta_data->'roles' ? 'admin')
     OR (u.raw_user_meta_data->>'role' = 'admin');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_application_submitted() OWNER TO postgres;

-- ── השלמת ההתראות לבקשות שכבר ממתינות ────────────────────────────
DO $do$
DECLARE
  v_created integer;
BEGIN
  WITH pending AS (
    SELECT id, 'שדכן' AS kind, '/app/admin/shadchanim/requests' AS link
    FROM public.shadchanim_info WHERE application_status = 'pending'
    UNION ALL
    SELECT id, 'איש צוות', '/app/admin/staff/requests'
    FROM public.staff_info WHERE application_status = 'pending'
  ),
  admins AS (
    SELECT id FROM auth.users
    WHERE (raw_user_meta_data->'roles' ? 'admin')
       OR (raw_user_meta_data->>'role' = 'admin')
  ),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    SELECT
      a.id,
      'application_submitted',
      'בקשת הצטרפות חדשה כ' || p.kind,
      'התקבלה בקשה חדשה הממתינה לבדיקה.',
      p.link,
      p.id
    FROM pending p
    CROSS JOIN admins a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = a.id
        AND n.type = 'application_submitted'
        AND n.related_id = p.id
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM inserted;

  RAISE NOTICE 'התראות שהושלמו לבקשות ממתינות: %', v_created;
END
$do$;
