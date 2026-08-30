-- טבלת institutions: מאגר מוסדות לימוד (ישיבות גדולות/קטנות, סמינרים, בתי
-- ספר, תלמודי תורה, כוללים וכו') המנוהל ע"י מנהל המערכת (app/app/admin/institutions).
-- המנהל הוא מקור האמת לרשימת המוסדות, ולכן students מתחבר אליה ב-FK
-- (institution_id) ולא בטקסט חופשי.
--
-- נדרשת ע"י:
--   - מסך ניהול מוסדות למנהל (app/app/admin/institutions/page.tsx)
--   - בורר מוסד באשף יצירת כרטיס מיועד (features/students/components/create-form)
--   - הפונקציה create_full_student_profile, שמשוכתבת בהמשך הקובץ כדי לקלוט
--     institution_id מה-payload

CREATE TABLE IF NOT EXISTS public.institutions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  city        text,
  gender      text NOT NULL CHECK (gender IN ('male', 'female')),
  type        text NOT NULL CHECK (type IN (
                'yeshiva_gedola', 'yeshiva_ketana', 'seminary', 'school',
                'talmud_torah', 'kollel', 'other'
              )),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.institutions IS 'מאגר מוסדות לימוד (ישיבות, סמינרים, בתי ספר וכו'') המנוהל ע"י מנהל המערכת. משמש לבחירת מוסד הלימודים של מיועד/ת באשף היצירה.';
COMMENT ON COLUMN public.institutions.name IS 'שם המוסד';
COMMENT ON COLUMN public.institutions.city IS 'עיר המוסד';
COMMENT ON COLUMN public.institutions.gender IS 'קהל היעד של המוסד: male (בנים) / female (בנות)';
COMMENT ON COLUMN public.institutions.type IS 'סוג המוסד: yeshiva_gedola, yeshiva_ketana, seminary, school, talmud_torah, kollel, other';
COMMENT ON COLUMN public.institutions.is_active IS 'האם המוסד פעיל ומוצג לבחירה באשף. מוסד לא פעיל נשאר ברשומות קיימות אך לא מוצע לבחירה חדשה.';

-- מונע כפילויות של אותו מוסד (אותו שם, עיר ומגדר). אינדקס ולא CONSTRAINT
-- רגיל כדי לאפשר הרצה אידמפוטנטית (IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS institutions_name_city_gender_unique_idx
  ON public.institutions (name, city, gender);

CREATE INDEX IF NOT EXISTS institutions_is_active_idx
  ON public.institutions (is_active);

-- טריגר updated_at, מקביל ל-update_staff_info_updated_at()
-- (supabase/migrations/20260830130000_create_staff_info_table.sql)
CREATE OR REPLACE FUNCTION public.update_institutions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_institutions_updated_at ON public.institutions;
CREATE TRIGGER trigger_update_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.update_institutions_updated_at();

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- כל משתמש מחובר צריך לקרוא את הרשימה כדי לבחור ממנה באשף, אבל רק מוסדות
-- פעילים. מנהל רואה הכל (כולל לא פעילים) דרך מדיניות ה-ALL שלמטה.
DROP POLICY IF EXISTS "Institutions select active for authenticated" ON public.institutions;
CREATE POLICY "Institutions select active for authenticated" ON public.institutions
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "Institutions admin manage all" ON public.institutions;
CREATE POLICY "Institutions admin manage all" ON public.institutions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON TABLE public.institutions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.institutions TO authenticated;
GRANT ALL ON TABLE public.institutions TO service_role;

-- חיבור students -> institutions. מחיקת מוסד לא מוחקת מיועדים המשוייכים
-- אליו, רק מנתקת את השיוך (ON DELETE SET NULL) - ראה אזהרה למנהל במסך הניהול.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.students.institution_id IS 'מוסד הלימודים של המיועד/ת, מתוך מאגר המוסדות המנוהל ע"י מנהל המערכת. NULL אם לא נבחר מוסד.';

CREATE INDEX IF NOT EXISTS students_institution_id_idx
  ON public.students (institution_id);

-- שכתוב create_full_student_profile: זהה לחלוטין לגרסה המקורית
-- (supabase/migrations/20260101000000_remote_baseline.sql, שורות 183-303),
-- בתוספת קריאת institution_id מה-payload והכנסתו לעמודה החדשה. אין שינוי
-- אחר בהתנהגות הפונקציה - אותה חתימה, LANGUAGE, SECURITY DEFINER ו-search_path.
CREATE OR REPLACE FUNCTION "public"."create_full_student_profile"("payload" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_student_id uuid;
BEGIN
  INSERT INTO public.students (
    user_id, in_shidduchim, first_name, last_name, identity_number, birth_date, gender,
    personal_status, height, phone, country, city, street, house, community,
    shtible, cellphone_type, plan_for_life, head_cover_type, image_url,
    cv_url, about, parents_info, family_info, author_info, institution_id
  )
  SELECT
    (payload->>'user_id')::uuid,
    COALESCE((payload->>'in_shidduchim')::boolean, true),
    payload->>'first_name',
    payload->>'last_name',
    payload->>'identity_number',
    (payload->>'birth_date')::date,
    (payload->>'gender')::gender_enum,
    (payload->>'personal_status')::personal_status_enum,
    (payload->>'height')::numeric,
    payload->>'phone',
    payload->>'country',
    payload->>'city',
    payload->>'street',
    payload->>'house',
    payload->>'community',
    payload->>'shtible',
    (payload->>'cellphone_type')::cellphone_type_enum,
    (payload->>'plan_for_life')::plan_for_life_enum,
    (payload->>'head_cover_type')::head_cover_type_enum,
    payload->>'image_url',
    payload->>'cv_url',
    payload->>'about',
    COALESCE(payload->'parents_info', '{}'::jsonb),
    COALESCE(payload->'family_info', '{}'::jsonb),
    COALESCE(payload->'author_info', '{}'::jsonb),
    (payload->>'institution_id')::uuid
  RETURNING id INTO new_student_id;

  IF payload->'education_history' IS NOT NULL AND jsonb_array_length(payload->'education_history') > 0 THEN
    INSERT INTO public.education_history (student_id, institution_type, name, community, city)
    SELECT
      new_student_id,
      (x->>'institution_type')::education_type_enum,
      x->>'name',
      x->>'community',
      x->>'city'
    FROM jsonb_array_elements(payload->'education_history') x;
  END IF;

  IF payload->'employment_history' IS NOT NULL AND jsonb_array_length(payload->'employment_history') > 0 THEN
    INSERT INTO public.employment_history (student_id, category, role, location, description)
    SELECT
      new_student_id,
      x->>'category',
      x->>'role',
      x->>'location',
      x->>'description'
    FROM jsonb_array_elements(payload->'employment_history') x;
  END IF;

  IF payload->'medical_records' IS NOT NULL THEN
    INSERT INTO public.medical_records (student_id, status, exposure_level, details, documents, contact_info, related_issue_preference)
    SELECT
      new_student_id,
      (payload->'medical_records'->>'status')::medical_status_enum,
      payload->'medical_records'->>'exposure_level',
      payload->'medical_records'->>'details',
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'medical_records'->'documents') x),
      payload->'medical_records'->'contact_info',
      payload->'medical_records'->>'related_issue_preference';
  END IF;

  IF payload->'partner_preferences' IS NOT NULL THEN
    INSERT INTO public.partner_preferences (student_id, age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type, about_partner, additional_information)
    SELECT
      new_student_id,
      (payload->'partner_preferences'->>'age_min')::int,
      (payload->'partner_preferences'->>'age_max')::int,
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'partner_preferences'->'preferred_countries') x),
      payload->'partner_preferences'->>'work_status',
      (payload->'partner_preferences'->>'head_cover_type')::head_cover_type_enum,
      (payload->'partner_preferences'->>'plan_for_life')::plan_for_life_enum,
      (payload->'partner_preferences'->>'cellphone_type')::cellphone_type_enum,
      payload->'partner_preferences'->>'about_partner',
      payload->'partner_preferences'->>'additional_information';
  END IF;

  IF payload->'references' IS NOT NULL AND jsonb_array_length(payload->'references') > 0 THEN
    INSERT INTO public.references (student_id, reference_type, name, phone, email)
    SELECT
      new_student_id,
      (x->>'reference_type')::reference_type_enum,
      x->>'name',
      x->>'phone',
      x->>'email'
    FROM jsonb_array_elements(payload->'references') x;
  END IF;

  IF payload->'previous_partners' IS NOT NULL AND jsonb_array_length(payload->'previous_partners') > 0 THEN
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, divorce_details)
    SELECT
      new_student_id,
      x->>'separation_type',
      x->>'full_name',
      (x->>'marriage_date')::date,
      (x->>'divorce_date')::date,
      (x->>'death_date')::date,
      (x->>'children_number')::int,
      x->'divorce_details'
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;

  RETURN new_student_id;
END;
$$;

ALTER FUNCTION "public"."create_full_student_profile"("payload" "jsonb") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."create_full_student_profile"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_full_student_profile"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_full_student_profile"("payload" "jsonb") TO "service_role";
