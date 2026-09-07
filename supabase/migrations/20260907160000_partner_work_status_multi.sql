-- "סטטוס תעסוקתי מבוקש" הפך לבחירה מרובה, ולכן work_status עובר
-- מ-text למערך text[]. ערכים קיימים נשמרים כמערך בן איבר אחד.
--
-- שים לב: preferred_countries באותה טבלה כבר text[], כך שהצורה הזו
-- אינה חדשה כאן.

-- אידמפוטנטי: ALTER COLUMN ... TYPE נכשל אם העמודה כבר הומרה, ולכן
-- ההמרה מותנית בסוג הנוכחי.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partner_preferences'
      AND column_name = 'work_status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.partner_preferences
      ALTER COLUMN work_status TYPE text[]
      USING (
        CASE
          WHEN work_status IS NULL OR TRIM(work_status) = '' THEN NULL
          ELSE ARRAY[work_status]
        END
      );
  END IF;
END
$do$;

-- ה-RPC כתב את השדה כסקלר; מעבירים אותו לחילוץ מערך, באותה צורה
-- שבה preferred_countries כבר נקרא.
CREATE OR REPLACE FUNCTION public.create_full_student_profile(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_student_id uuid;
  v_owner uuid;
BEGIN
  -- הבעלים נקבע מהסשן ולא מה-payload. קודם התקבל (payload->>'user_id'),
  -- ומכיוון שהפונקציה SECURITY DEFINER ומוענקת ל-anon, כל קורא יכול היה
  -- ליצור כרטיס מיועד בבעלות משתמש שרירותי ולעקוף לגמרי את מדיניות ה-RLS.
  v_owner := auth.uid();
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'יצירת כרטיס מיועד דורשת התחברות';
  END IF;

  INSERT INTO public.students (
    user_id, in_shidduchim, first_name, last_name, identity_number, birth_date, gender,
    personal_status, height, phone, country, city, street, house, community,
    shtible, cellphone_type, plan_for_life, head_cover_type, image_url,
    cv_url, about, parents_info, family_info, author_info, institution_id
  )
  SELECT
    v_owner,
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
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'partner_preferences'->'work_status') x),
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
$function$;

