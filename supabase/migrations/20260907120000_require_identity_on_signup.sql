-- אכיפת שדות זיהוי בהרשמה: שם פרטי, שם משפחה, טלפון ואימייל.
--
-- הלקוח מדבר ישירות מול Supabase עם המפתח הציבורי, ולכן ולידציה בטפסים
-- ניתנת לעקיפה בקריאת API מהדפדפן. הטריגר כאן הוא שכבת האכיפה היחידה
-- שלא ניתנת לעקיפה — הוא רץ על כל יצירת משתמש, מכל מקור.

-- הטלפון מגיע משני מקורות לגיטימיים:
--   1. auth.users.phone       — admin.createUser({ phone }) ב-app/api/v1/users
--   2. raw_user_meta_data     — signInWithOtp({ options: { data: { phone } } })
-- שניהם תקפים, ולכן נבדוק את שניהם.
CREATE OR REPLACE FUNCTION "public"."enforce_signup_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  fn    text;
  ln    text;
  ph    text;
  meta  jsonb;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  fn := COALESCE(
    NULLIF(TRIM(meta->>'firstName'), ''),
    NULLIF(TRIM(meta->>'first_name'), '')
  );
  ln := COALESCE(
    NULLIF(TRIM(meta->>'lastName'), ''),
    NULLIF(TRIM(meta->>'last_name'), '')
  );
  ph := COALESCE(
    NULLIF(TRIM(NEW.phone), ''),
    NULLIF(TRIM(meta->>'phone'), '')
  );

  IF fn IS NULL OR ln IS NULL THEN
    RAISE EXCEPTION 'signup_requires_full_name'
      USING HINT = 'נדרשים שם פרטי ושם משפחה בהרשמה';
  END IF;

  IF ph IS NULL THEN
    RAISE EXCEPTION 'signup_requires_phone'
      USING HINT = 'נדרש מספר טלפון בהרשמה';
  END IF;

  -- בדיקת נוכחות ותקינות בסיסית בלבד. אימות פורמט מלא נשאר ב-lib/phone.ts,
  -- כדי לא לשכפל את הלוגיקה בשתי שפות.
  IF LENGTH(REGEXP_REPLACE(ph, '\D', '', 'g')) NOT BETWEEN 7 AND 15 THEN
    RAISE EXCEPTION 'signup_requires_valid_phone'
      USING HINT = 'מספר טלפון חייב להכיל 7 עד 15 ספרות';
  END IF;

  IF NULLIF(TRIM(COALESCE(NEW.email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'signup_requires_email'
      USING HINT = 'נדרשת כתובת אימייל בהרשמה';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_signup_identity"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."enforce_signup_identity"() IS
  'דוחה יצירת משתמש ללא שם פרטי, שם משפחה, טלפון ואימייל. אכיפה בלתי-עקיפה לכל מסלולי ההרשמה.';

DROP TRIGGER IF EXISTS "enforce_signup_identity" ON "auth"."users";

CREATE TRIGGER "enforce_signup_identity"
  BEFORE INSERT ON "auth"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."enforce_signup_identity"();
