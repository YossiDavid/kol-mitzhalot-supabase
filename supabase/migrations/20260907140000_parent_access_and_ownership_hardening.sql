-- פתיחת גישת הורים + סגירת שתי פרצות בבעלות על כרטיס מיועד.
--
-- רקע: "הורה" אינו תפקיד נפרד — getRoles() מחזיר ["user"] כברירת מחדל
-- למשתמש ללא תפקיד, ולכן כל נרשם חדש הוא הורה. מדיניות ה-RLS על students
-- כבר מצמצמת הורה לילדיו (auth.uid() = user_id), כך שאין צורך להעניק תפקיד.
--
-- שתי פרצות שנמצאו במסלול הזה:
--
-- 1. create_full_student_profile היא SECURITY DEFINER, מוענקת ל-PUBLIC
--    ול-anon, ולקחה את הבעלים מ-(payload->>'user_id'). כל קורא — גם לא
--    מחובר — יכול היה ליצור כרטיס מיועד בבעלות משתמש שרירותי, בעקיפה
--    מלאה של מדיניות ה-INSERT.
--
-- 2. מדיניות ה-UPDATE על students הגדירה USING בלבד ללא WITH CHECK, ולכן
--    בעלים יכול היה להריץ UPDATE students SET user_id = '<uuid אחר>'
--    ולהעביר את כרטיס ילדו לידי משתמש כלשהו.

-- ── 1. הבעלים נקבע מהסשן ──────────────────────────────────────────────
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
$function$;


-- הרשאת הרצה לאנונימי ול-PUBLIC אינה נדרשת: היוצר חייב להיות מחובר.
REVOKE ALL ON FUNCTION "public"."create_full_student_profile"("jsonb") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."create_full_student_profile"("jsonb") FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."create_full_student_profile"("jsonb") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_full_student_profile"("jsonb") TO "service_role";

-- ── 2. מניעת העברת בעלות ב-UPDATE ─────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own profile" ON "public"."students";
CREATE POLICY "Users can update their own profile"
  ON "public"."students" FOR UPDATE
  TO "authenticated"
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
