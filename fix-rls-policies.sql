-- תיקון RLS Policies עבור טבלאות הקשורות לסטודנטים
-- הבעיה: הפונקציה המאוחסנת לא יכולה להוסיף שורות בגלל RLS policies

-- אופציה 1: הגדרת הפונקציה כ-SECURITY DEFINER (מומלץ)
-- זה יגרום לפונקציה לרוץ עם הרשאות של הבעלים (postgres) במקום המשתמש המאומת
DROP FUNCTION IF EXISTS create_full_student_profile(jsonb);

CREATE OR REPLACE FUNCTION create_full_student_profile(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- זה מאפשר לפונקציה לרוץ עם הרשאות של הבעלים
SET search_path = public
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
    COALESCE(payload->'author_info', '{}'::jsonb)
  RETURNING id INTO new_student_id;

  -- 2. Insert Education History
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
      (payload->'medical_records'->>'status')::medical_status_enum,
      payload->'medical_records'->>'exposure_level',
      payload->'medical_records'->>'details',
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
      (payload->'partner_preferences'->>'head_cover_type')::head_cover_type_enum,
      (payload->'partner_preferences'->>'plan_for_life')::plan_for_life_enum,
      (payload->'partner_preferences'->>'cellphone_type')::cellphone_type_enum,
      payload->'partner_preferences'->>'about_partner',
      payload->'partner_preferences'->>'additional_information';
  END IF;

  -- 6. Insert References
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

-- אופציה 2: אם אתה מעדיף לא להשתמש ב-SECURITY DEFINER, תוכל להגדיר RLS policies
-- שמאפשרים למשתמש להוסיף שורות לסטודנט שהוא יצר:

-- Policy עבור education_history
DROP POLICY IF EXISTS "Users can insert education history for their students" ON public.education_history;
CREATE POLICY "Users can insert education history for their students"
ON public.education_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = education_history.student_id
    AND students.user_id = auth.uid()
  )
);

-- Policy עבור employment_history
DROP POLICY IF EXISTS "Users can insert employment history for their students" ON public.employment_history;
CREATE POLICY "Users can insert employment history for their students"
ON public.employment_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = employment_history.student_id
    AND students.user_id = auth.uid()
  )
);

-- Policy עבור medical_records
DROP POLICY IF EXISTS "Users can insert medical records for their students" ON public.medical_records;
CREATE POLICY "Users can insert medical records for their students"
ON public.medical_records
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = medical_records.student_id
    AND students.user_id = auth.uid()
  )
);

-- Policy עבור partner_preferences
DROP POLICY IF EXISTS "Users can insert partner preferences for their students" ON public.partner_preferences;
CREATE POLICY "Users can insert partner preferences for their students"
ON public.partner_preferences
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = partner_preferences.student_id
    AND students.user_id = auth.uid()
  )
);

-- Policy עבור references (references היא מילה שמורה, צריך להשתמש ב-quotes)
DROP POLICY IF EXISTS "Users can insert references for their students" ON public.references;
CREATE POLICY "Users can insert references for their students"
ON public.references
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = public.references.student_id
    AND students.user_id = auth.uid()
  )
);

-- Policy עבור previous_partners
DROP POLICY IF EXISTS "Users can insert previous partners for their students" ON public.previous_partners;
CREATE POLICY "Users can insert previous partners for their students"
ON public.previous_partners
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = previous_partners.student_id
    AND students.user_id = auth.uid()
  )
);

-- הערה: אופציה 1 (SECURITY DEFINER) היא המומלצת כי היא פשוטה יותר ומאובטחת
-- אופציה 2 דורשת policies מורכבים יותר אבל נותנת יותר שליטה

