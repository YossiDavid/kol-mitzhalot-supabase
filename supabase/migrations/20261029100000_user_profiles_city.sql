-- עיר בהרשמה: שדה חובה בטופס ההרשמה, נשמר ב-user_metadata.city ומועתק
-- לעמודה החדשה user_profiles.city בטריגר הסנכרון (sync_user_profile).
--
--  * העמודה nullable: למשתמשים קיימים ולמשתמשים שנוצרו בידי מנהל אין עיר.
--  * הטריגר: ההגדרה מ-20260101000000_remote_baseline.sql, עם city כתוספת בלבד.
--    כמו בשמות - ערך ריק במטא-דאטה לא דורס ערך קיים בפרופיל.
--  * השלמה חד-פעמית: פרופילים קיימים בלי עיר מקבלים אותה מהמטא-דאטה.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_city_length_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_city_length_check
  CHECK (city IS NULL OR char_length(city) <= 100);

COMMENT ON COLUMN public.user_profiles.city IS
  'העיר שהוזנה בהרשמה (user_metadata.city). ריק למשתמשים ותיקים.';

CREATE OR REPLACE FUNCTION public.sync_user_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  fn text;
  ln text;
  v_city text;
BEGIN
  fn := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'firstName'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '')
  );
  ln := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'lastName'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), '')
  );
  -- חיתוך לאורך המותר: ערך ארוך במטא-דאטה לא יפיל את ההרשמה כולה
  v_city := LEFT(NULLIF(TRIM(NEW.raw_user_meta_data->>'city'), ''), 100);

  INSERT INTO public.user_profiles (id, first_name, last_name, email, city, updated_at)
  VALUES (
    NEW.id,
    fn,
    ln,
    NEW.email,
    v_city,
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    first_name = COALESCE(fn, user_profiles.first_name),
    last_name = COALESCE(ln, user_profiles.last_name),
    email = COALESCE(NEW.email, user_profiles.email),
    city = COALESCE(v_city, user_profiles.city),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_user_profile() OWNER TO postgres;

-- השלמת עיר לפרופילים קיימים (לא דורס ערך קיים)
UPDATE public.user_profiles p
SET city = LEFT(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), 100)
FROM auth.users u
WHERE u.id = p.id
  AND p.city IS NULL
  AND NULLIF(TRIM(u.raw_user_meta_data->>'city'), '') IS NOT NULL;

-- ── Rollback (להריץ ידנית) ──
-- 1. להחזיר את sync_user_profile להגדרה שב-20260101000000_remote_baseline.sql
-- 2. ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_city_length_check;
-- 3. ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS city;
