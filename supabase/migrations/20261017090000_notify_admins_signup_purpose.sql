-- התראת "משתמש חדש נרשם" למנהלים: מוסיפה לגוף ההתראה את מטרת ההרשמה
-- (user_metadata.signup_purpose), באותן תוויות עבריות כמו
-- features/auth/lib/signup-purpose.ts. מטרה חסרה או לא מוכרת - בלי השורה.
--
-- ההגדרה מועתקת כלשונה מ-20261007100000_roles_to_app_metadata.sql; השינוי היחיד
-- הוא v_purpose_label ושורת המטרה בגוף ההתראה. אידמפוטנטית (CREATE OR REPLACE).
-- להחלה: psql -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.notify_admins_user_registered() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_name text;
  v_purpose_label text;
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

    -- התוויות זהות ל-SIGNUP_PURPOSE_OPTIONS; ערך לא מוכר נשאר NULL
    v_purpose_label := CASE NEW.raw_user_meta_data->>'signup_purpose'
      WHEN 'self' THEN 'אני מחפש/ת שידוך לעצמי'
      WHEN 'child' THEN 'אני מחפש/ת שידוך לבני/בתי'
      WHEN 'shadchan' THEN 'אני רוצה להצטרף כשדכן/ית'
      WHEN 'other' THEN 'אחר'
      ELSE NULL
    END;

    -- כל המנהלים (אותו פרדיקט כמו notify_admins_application_submitted)
    INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
    SELECT
      u.id,
      'user_registered',
      'משתמש חדש נרשם',
      left(
        COALESCE(v_name, 'ללא שם') || ' (' || COALESCE(NEW.email, 'ללא אימייל') || ')'
          || COALESCE(E'\nמטרת ההרשמה: ' || v_purpose_label, ''),
        300
      ),
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
  IS 'מתריע לכל המנהלים על משתמש חדש (כולל מטרת ההרשמה) ויוצר סימון למייל. לעולם לא חוסם הרשמה.';

-- ── Rollback (להריץ ידנית): ההגדרה הקודמת, מ-20261007100000 ──
-- CREATE OR REPLACE FUNCTION public.notify_admins_user_registered() RETURNS trigger
--     LANGUAGE plpgsql SECURITY DEFINER
--     SET search_path TO 'public', 'auth'
--     AS $$
-- DECLARE
--   v_name text;
-- BEGIN
--   BEGIN
--     INSERT INTO public.signup_admin_notifications (user_id)
--     VALUES (NEW.id)
--     ON CONFLICT (user_id) DO NOTHING;
--   EXCEPTION WHEN OTHERS THEN
--     RAISE WARNING 'notify_admins_user_registered: marker failed: %', SQLERRM;
--   END;
--
--   BEGIN
--     v_name := NULLIF(BTRIM(
--       COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'firstName', NEW.raw_user_meta_data->>'first_name', '')), ''), '')
--       || ' ' ||
--       COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'lastName', NEW.raw_user_meta_data->>'last_name', '')), ''), '')
--     ), '');
--
--     -- כל המנהלים (אותו פרדיקט כמו notify_admins_application_submitted)
--     INSERT INTO public.notifications (user_id, type, title, body, link, related_id)
--     SELECT
--       u.id,
--       'user_registered',
--       'משתמש חדש נרשם',
--       left(COALESCE(v_name, 'ללא שם') || ' (' || COALESCE(NEW.email, 'ללא אימייל') || ')', 300),
--       '/app/admin/users/' || NEW.id::text,
--       NEW.id
--     FROM auth.users u
--     WHERE u.id <> NEW.id
--       AND (u.raw_app_meta_data->'roles' ? 'admin');
--   EXCEPTION WHEN OTHERS THEN
--     RAISE WARNING 'notify_admins_user_registered: notification failed: %', SQLERRM;
--   END;
--
--   RETURN NEW;
-- END;
-- $$;
