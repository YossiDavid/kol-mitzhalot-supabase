-- ════════════════════════════════════════════════════════════════════════
-- תפקידים (admin / shadchan / staff) עוברים מ-user_metadata ל-app_metadata.
--
-- הפרצה: raw_user_meta_data (user_metadata) ניתן לכתיבה ע"י המשתמש עצמו -
-- כל משתמש מחובר יכול להריץ מהדפדפן
--   supabase.auth.updateUser({ data: { roles: ["admin"] } })
-- ולהפוך למנהל, כי public.has_role קרא את התפקידים משם. raw_app_meta_data
-- (app_metadata) ניתן לכתיבה רק ל-service role / Admin API, ולכן התפקידים
-- יושבים שם מעכשיו: app_metadata.roles (מערך).
--
-- מיגרציה זו:
--   1. Backfill: app_metadata.roles = איחוד של app_metadata.roles הקיים,
--      user_metadata.roles ו-user_metadata.role (הסקלר הישן), רק לערכים
--      admin/shadchan/staff, בלי כפילויות. שאר מפתחות app_metadata
--      (provider/providers) נשמרים. אף משתמש לא מורד: האיחוד כולל תמיד את
--      התפקידים שכבר יש לו ב-app_metadata.
--   2. יוצרת מחדש כל פונקציה שקוראת תפקידים כך שתקרא רק את
--      raw_app_meta_data->'roles'.
--   3. לא נוגעת ב-raw_user_meta_data: הקוד שכרגע בפרודקשן עדיין קורא ממנו עד
--      שהקוד החדש עולה. ניקוי user_metadata נעשה במיגרציה נפרדת
--      (20261007100100_strip_user_metadata_roles.sql) שרצה רק אחרי שהקוד עלה.
--
-- אזהרה: ה-backfill סומך על user_metadata כפי שהוא ברגע ההרצה. מי שכבר ניצל
-- את הפרצה לפני המיגרציה (כתב roles ל-user_metadata של עצמו) יקודם באמת.
-- לפני ההרצה בפרודקשן יש לבדוק את רשימת המשתמשים עם תפקידים ב-
-- user_metadata ולוודא שהיא תואמת לצפוי - ראה docs/SECURITY_ROLES_DEPLOY.md.
-- ה-backfill מדפיס RAISE NOTICE לכל משתמש שמקבל תפקיד חדש, ושורת סיכום.
--
-- אידמפוטנטית - ניתן להריץ שוב.
-- ════════════════════════════════════════════════════════════════════════

-- ── 0. נתיב ביקורת ──────────────────────────────────────────────────
-- RAISE NOTICE לכל משתמש שעומד לקבל תפקיד שאין לו כבר ב-app_metadata (מזהה,
-- אימייל, התפקידים שנוספו) ושורת סיכום, כדי שמי שמריץ בפרודקשן יראה בדיוק מי
-- קודם. הבלוק לא משנה כלום; אחרי ההרצה הראשונה אין עוד מי שיקבל תפקיד, ולכן
-- הוא שקט בהרצה חוזרת.
DO $audit$
DECLARE
  r record;
  v_users integer := 0;
BEGIN
  FOR r IN
    SELECT
      u.id,
      u.email,
      (
        SELECT string_agg(k.role, ', ' ORDER BY k.ord)
        FROM (VALUES ('admin', 1), ('shadchan', 2), ('staff', 3)) AS k(role, ord)
        WHERE NOT (jsonb_typeof(u.raw_app_meta_data->'roles') = 'array'
                   AND u.raw_app_meta_data->'roles' ? k.role)
          AND ((jsonb_typeof(u.raw_user_meta_data->'roles') = 'array'
                AND u.raw_user_meta_data->'roles' ? k.role)
            OR (jsonb_typeof(u.raw_user_meta_data->'role') = 'string'
                AND u.raw_user_meta_data->>'role' = k.role))
      ) AS gained
    FROM auth.users u
    ORDER BY u.created_at
  LOOP
    IF r.gained IS NOT NULL THEN
      v_users := v_users + 1;
      RAISE NOTICE 'roles backfill: user % (%) gains: %', r.id, COALESCE(r.email, 'no email'), r.gained;
    END IF;
  END LOOP;
  RAISE NOTICE 'roles backfill: % user(s) receive a role they did not hold in app_metadata', v_users;
END
$audit$;

-- ── 1. Backfill ─────────────────────────────────────────────────────
-- "user" הוא ברירת המחדל המשתמעת (אין צורך לשמור אותו), ולכן רק שלושת
-- התפקידים האמיתיים נשמרים. הסדר קבוע (admin, shadchan, staff) כדי שהתוצאה
-- דטרמיניסטית ושהתנאי "שונה מהקיים" יהפוך false אחרי ההרצה הראשונה.
-- בדיקת jsonb_typeof = 'array' חובה: האופרטור ? על סקלר מחרוזתי בודק שוויון,
-- ועל אובייקט בודק מפתח - ומשתמש יכול היה לכתוב כל צורה ל-user_metadata.
WITH computed AS (
  SELECT
    u.id,
    (
      SELECT jsonb_agg(k.role ORDER BY k.ord)
      FROM (VALUES ('admin', 1), ('shadchan', 2), ('staff', 3)) AS k(role, ord)
      WHERE (jsonb_typeof(u.raw_app_meta_data->'roles') = 'array'
             AND u.raw_app_meta_data->'roles' ? k.role)
         OR (jsonb_typeof(u.raw_user_meta_data->'roles') = 'array'
             AND u.raw_user_meta_data->'roles' ? k.role)
         OR (jsonb_typeof(u.raw_user_meta_data->'role') = 'string'
             AND u.raw_user_meta_data->>'role' = k.role)
    ) AS roles
  FROM auth.users u
)
UPDATE auth.users u
SET raw_app_meta_data =
  COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('roles', c.roles)
FROM computed c
WHERE c.id = u.id
  AND c.roles IS NOT NULL
  AND (u.raw_app_meta_data->'roles') IS DISTINCT FROM c.roles;

-- ── 2. פונקציות ─────────────────────────────────────────────────────
-- הפונקציה המרכזית. is_admin() / is_admin(uuid) / is_shadchan() /
-- is_shadchan_or_admin() / is_shadchan_contact_limit_exempt() וכל ה-RLS
-- נשענים עליה, ולכן אין צורך ליצור אותן מחדש - הן יורשות את ההתנהגות.
CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = uid
    AND (raw_app_meta_data->'roles' ? role_name)
  );
$$;

ALTER FUNCTION public.has_role(uuid, text) OWNER TO postgres;

COMMENT ON FUNCTION public.has_role(uuid, text) IS 'בודק אם למשתמש יש תפקיד נתון - קורא רק את app_metadata.roles (raw_app_meta_data), שניתן לכתיבה רק ע"י service role. user_metadata לעולם לא נקרא.';

GRANT ALL ON FUNCTION public.has_role(uuid, text) TO anon;
GRANT ALL ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(uuid, text) TO service_role;

-- מ-20260908060000_backfill_pending_application_notifications.sql
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
  WHERE u.raw_app_meta_data->'roles' ? 'admin';

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_application_submitted() OWNER TO postgres;

-- מ-20260908140000_photo_view_requests.sql
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

  -- כל המנהלים: app_metadata.roles, בדיוק כמו public.has_role.
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
  WHERE u.raw_app_meta_data->'roles' ? 'admin';

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_photo_request() OWNER TO postgres;

-- מ-20261005140000_notifications_fixes.sql
CREATE OR REPLACE FUNCTION public.get_admin_emails() RETURNS TABLE (email text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT u.email::text
  FROM auth.users u
  WHERE u.email IS NOT NULL
    AND (u.raw_app_meta_data->'roles' ? 'admin');
$$;

ALTER FUNCTION public.get_admin_emails() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_admin_emails() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_emails() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_emails() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_emails() TO service_role;

-- מ-20261005140000_notifications_fixes.sql
CREATE OR REPLACE FUNCTION public.notify_admins_user_registered() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_name text;
BEGIN
  BEGIN
    INSERT INTO public.signup_admin_notifications (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admins_user_registered: marker failed: %', SQLERRM;
  END;

  BEGIN
    v_name := NULLIF(BTRIM(
      COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'firstName', NEW.raw_user_meta_data->>'first_name', '')), ''), '')
      || ' ' ||
      COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'lastName', NEW.raw_user_meta_data->>'last_name', '')), ''), '')
    ), '');

    -- כל המנהלים (אותו פרדיקט כמו notify_admins_application_submitted)
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    SELECT
      u.id,
      'user_registered',
      'משתמש חדש נרשם',
      left(COALESCE(v_name, 'ללא שם') || ' (' || COALESCE(NEW.email, 'ללא אימייל') || ')', 300),
      '/app/admin/users/' || NEW.id::text,
      NEW.id
    FROM auth.users u
    WHERE u.id <> NEW.id
      AND (u.raw_app_meta_data->'roles' ? 'admin');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admins_user_registered: notification failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.notify_admins_user_registered() OWNER TO postgres;

COMMENT ON FUNCTION public.notify_admins_user_registered()
  IS 'מתריע לכל המנהלים על משתמש חדש ויוצר סימון למייל. לעולם לא חוסם הרשמה.';
