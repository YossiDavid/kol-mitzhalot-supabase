-- תיקון הפונקציה create_full_student_profile
-- הבעיה: השימוש ב-public."USER-DEFINED" במקום בשמות הנכונים של ה-enum types

-- מחיקת הפונקציה הקיימת (אם יש)
DROP FUNCTION IF EXISTS create_full_student_profile(jsonb);

-- יצירת הפונקציה המתוקנת
CREATE OR REPLACE FUNCTION create_full_student_profile(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_student_id uuid;
BEGIN
  -- 1. Insert into Students (Main Table)
  INSERT INTO public.students (
    user_id, first_name, last_name, identity_number, birth_date, gender, 
    personal_status, height, phone, country, city, street, house, community, 
    shtible, cellphone_type, plan_for_life, head_cover_type, image_url, 
    cv_url, about, parents_info, family_info, author_info
  )
  SELECT 
    (payload->>'user_id')::uuid,
    payload->>'first_name',
    payload->>'last_name',
    payload->>'identity_number',
    (payload->>'birth_date')::date,
    (payload->>'gender')::gender_enum, -- תיקון: במקום public."USER-DEFINED"
    (payload->>'personal_status')::personal_status_enum, -- תיקון
    (payload->>'height')::numeric,
    payload->>'phone',
    payload->>'country',
    payload->>'city',
    payload->>'street',
    payload->>'house',
    payload->>'community',
    payload->>'shtible',
    (payload->>'cellphone_type')::cellphone_type_enum, -- תיקון
    (payload->>'plan_for_life')::plan_for_life_enum, -- תיקון
    (payload->>'head_cover_type')::head_cover_type_enum, -- תיקון
    payload->>'image_url',
    payload->>'cv_url',
    payload->>'about',
    COALESCE(payload->'parents_info', '{}'::jsonb),
    COALESCE(payload->'family_info', '{}'::jsonb),
    COALESCE(payload->'author_info', '{}'::jsonb)
  RETURNING id INTO new_student_id;

  -- 2. Insert Education History
  IF payload->'education_history' IS NOT NULL AND jsonb_array_length(payload->'education_history') > 0 THEN
    INSERT INTO public.education_history (student_id, institution_type, name, community, city)
    SELECT 
      new_student_id,
      (x->>'institution_type')::education_type_enum, -- תיקון
      x->>'name',
      x->>'community',
      x->>'city'
    FROM jsonb_array_elements(payload->'education_history') x;
  END IF;

  -- 3. Insert Employment History
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

  -- 4. Insert Medical Records (One to One)
  IF payload->'medical_records' IS NOT NULL THEN
    INSERT INTO public.medical_records (student_id, status, exposure_level, details, documents, contact_info, related_issue_preference)
    SELECT 
      new_student_id,
      (payload->'medical_records'->>'status')::medical_status_enum, -- תיקון
      payload->'medical_records'->>'exposure_level',
      payload->'medical_records'->>'details',
      -- המרה של מערך טקסטים (URLs) למערך של Postgres
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'medical_records'->'documents') x), 
      payload->'medical_records'->'contact_info',
      payload->'medical_records'->>'related_issue_preference';
  END IF;

  -- 5. Insert Partner Preferences
  IF payload->'partner_preferences' IS NOT NULL THEN
    INSERT INTO public.partner_preferences (student_id, age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type, about_partner, additional_information)
    SELECT 
      new_student_id,
      (payload->'partner_preferences'->>'age_min')::int,
      (payload->'partner_preferences'->>'age_max')::int,
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'partner_preferences'->'preferred_countries') x),
      payload->'partner_preferences'->>'work_status',
      (payload->'partner_preferences'->>'head_cover_type')::head_cover_type_enum, -- תיקון
      (payload->'partner_preferences'->>'plan_for_life')::plan_for_life_enum, -- תיקון
      (payload->'partner_preferences'->>'cellphone_type')::cellphone_type_enum, -- תיקון
      payload->'partner_preferences'->>'about_partner',
      payload->'partner_preferences'->>'additional_information';
  END IF;

  -- 6. Insert References
  IF payload->'references' IS NOT NULL AND jsonb_array_length(payload->'references') > 0 THEN
    INSERT INTO public.references (student_id, reference_type, name, phone, email)
    SELECT 
      new_student_id,
      (x->>'reference_type')::reference_type_enum, -- תיקון
      x->>'name',
      x->>'phone',
      x->>'email'
    FROM jsonb_array_elements(payload->'references') x;
  END IF;
  
  -- 7. Insert Previous Partners
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

-- הערה: ודא/י שכל ה-enum types קיימים במסד הנתונים:
-- - gender_enum
-- - personal_status_enum
-- - cellphone_type_enum
-- - head_cover_type_enum
-- - plan_for_life_enum
-- - medical_status_enum
-- - education_type_enum
-- - reference_type_enum

