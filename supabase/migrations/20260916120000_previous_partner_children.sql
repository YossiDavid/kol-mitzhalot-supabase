-- ילדים מנישואים קודמים (גרושים/ות, אלמנים/ות).
--
-- עד כה נשמר רק children_number. הטופס מוסיף לכל נישואים קודמים את רשימת
-- הילדים עצמם: מין, תאריך לידה (הגיל מחושב בתצוגה), אצל מי הילד/ה גר/ה
-- והאם נשוי/אה. מספר הילדים נגזר מהרשימה.
--
-- הרשימה נשמרת כ-jsonb בשורת previous_partners ולא בטבלה נפרדת: היא תמיד
-- נקראת ונכתבת יחד עם השורה (ה-RPC מוחק וכותב מחדש את כל השורות), ואין
-- עליה שאילתות חיפוש.
--
-- children_number נשאר: בשורות ישנות יש מספר בלי פרטים. כשיש רשימה - המספר
-- נגזר ממנה; כשאין - נשמר המספר שהטופס שלח (הרשומה הישנה).
--
-- אידמפוטנטי — ניתן להריץ שוב.

-- ── 1. העמודה ────────────────────────────────────────────────────────
ALTER TABLE public.previous_partners
  ADD COLUMN IF NOT EXISTS children jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'previous_partners_children_is_array'
      AND conrelid = 'public.previous_partners'::regclass
  ) THEN
    ALTER TABLE public.previous_partners
      ADD CONSTRAINT previous_partners_children_is_array
      CHECK (jsonb_typeof(children) = 'array');
  END IF;
END
$do$;

COMMENT ON COLUMN public.previous_partners.children IS
  'ילדים מנישואים אלו, מערך של { gender: ''male''|''female'', birth_date: ''YYYY-MM-DD'', lives_with: ''student''|''other_parent''|''shared''|''independent''|null, is_married: boolean }. children_number נגזר ממנו כשאינו ריק.';

-- ── 2. יצירת כרטיס ──────────────────────────────────────────────────
-- הגוף המלא מ-20260907160000_partner_work_status_multi.sql. השינוי היחיד:
-- הכתיבה ל-previous_partners כוללת את children ואת children_number הנגזר.
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
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, children, divorce_details)
    SELECT
      new_student_id,
      x->>'separation_type',
      x->>'full_name',
      (x->>'marriage_date')::date,
      (x->>'divorce_date')::date,
      (x->>'death_date')::date,
      -- יש רשימה: המספר נגזר ממנה. אין: המספר שנשלח (שורה ישנה בלי פרטים)
      CASE
        WHEN jsonb_typeof(x->'children') = 'array' AND jsonb_array_length(x->'children') > 0
          THEN jsonb_array_length(x->'children')
        ELSE (x->>'children_number')::int
      END,
      -- children חסר או אינו מערך (גם JSON null) נשמר כרשימה ריקה
      CASE
        WHEN jsonb_typeof(x->'children') = 'array' THEN x->'children'
        ELSE '[]'::jsonb
      END,
      x->'divorce_details'
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;

  RETURN new_student_id;
END;
$function$;

ALTER FUNCTION public.create_full_student_profile(jsonb) OWNER TO postgres;

-- אותן הרשאות כמו ב-20260907140000_parent_access_and_ownership_hardening.sql
REVOKE ALL ON FUNCTION public.create_full_student_profile(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_full_student_profile(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_full_student_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_full_student_profile(jsonb) TO service_role;

-- ── 3. עריכת כרטיס ──────────────────────────────────────────────────
-- הגוף המלא מ-20260908120000_update_student_profile_rpc.sql. השינוי היחיד:
-- הכתיבה ל-previous_partners, בדיוק כמו ביצירה.
CREATE OR REPLACE FUNCTION public.update_full_student_profile(
  p_student_id uuid,
  payload      jsonb
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $function$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required'
      USING HINT = 'עריכת כרטיס דורשת התחברות';
  END IF;

  SELECT user_id INTO v_owner
  FROM public.students
  WHERE id = p_student_id AND deleted_at IS NULL;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'student_not_found'
      USING HINT = 'הכרטיס לא נמצא';
  END IF;

  -- בעל הכרטיס, או שדכן/מנהל. שאר המשתמשים נדחים.
  IF v_owner <> auth.uid() AND NOT public.is_shadchan_or_admin() THEN
    RAISE EXCEPTION 'not_allowed'
      USING HINT = 'אין הרשאה לערוך כרטיס זה';
  END IF;

  -- user_id לא נכלל: עריכה אינה מעבירה בעלות.
  UPDATE public.students SET
    in_shidduchim = COALESCE((payload->>'in_shidduchim')::boolean, true),
    first_name = payload->>'first_name',
    last_name = payload->>'last_name',
    identity_number = payload->>'identity_number',
    birth_date = (payload->>'birth_date')::date,
    gender = (payload->>'gender')::gender_enum,
    personal_status = (payload->>'personal_status')::personal_status_enum,
    height = (payload->>'height')::numeric,
    phone = payload->>'phone',
    country = payload->>'country',
    city = payload->>'city',
    street = payload->>'street',
    house = payload->>'house',
    community = payload->>'community',
    shtible = payload->>'shtible',
    cellphone_type = (payload->>'cellphone_type')::cellphone_type_enum,
    plan_for_life = (payload->>'plan_for_life')::plan_for_life_enum,
    head_cover_type = (payload->>'head_cover_type')::head_cover_type_enum,
    image_url = payload->>'image_url',
    cv_url = payload->>'cv_url',
    about = payload->>'about',
    parents_info = COALESCE(payload->'parents_info', '{}'::jsonb),
    family_info = COALESCE(payload->'family_info', '{}'::jsonb),
    author_info = COALESCE(payload->'author_info', '{}'::jsonb),
    institution_id = (payload->>'institution_id')::uuid
  WHERE id = p_student_id;

  IF payload->'education_history' IS NOT NULL AND jsonb_array_length(payload->'education_history') > 0 THEN
    DELETE FROM public.education_history WHERE student_id = p_student_id;
    INSERT INTO public.education_history (student_id, institution_type, name, community, city)
    SELECT
      p_student_id,
      (x->>'institution_type')::education_type_enum,
      x->>'name',
      x->>'community',
      x->>'city'
    FROM jsonb_array_elements(payload->'education_history') x;
  END IF;

  IF payload->'employment_history' IS NOT NULL AND jsonb_array_length(payload->'employment_history') > 0 THEN
    DELETE FROM public.employment_history WHERE student_id = p_student_id;
    INSERT INTO public.employment_history (student_id, category, role, location, description)
    SELECT
      p_student_id,
      x->>'category',
      x->>'role',
      x->>'location',
      x->>'description'
    FROM jsonb_array_elements(payload->'employment_history') x;
  END IF;

  IF payload->'medical_records' IS NOT NULL THEN
    DELETE FROM public.medical_records WHERE student_id = p_student_id;
    INSERT INTO public.medical_records (student_id, status, exposure_level, details, documents, contact_info, related_issue_preference)
    SELECT
      p_student_id,
      (payload->'medical_records'->>'status')::medical_status_enum,
      payload->'medical_records'->>'exposure_level',
      payload->'medical_records'->>'details',
      (SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'medical_records'->'documents') x),
      payload->'medical_records'->'contact_info',
      payload->'medical_records'->>'related_issue_preference';
  END IF;

  IF payload->'partner_preferences' IS NOT NULL THEN
    DELETE FROM public.partner_preferences WHERE student_id = p_student_id;
    INSERT INTO public.partner_preferences (student_id, age_min, age_max, preferred_countries, work_status, head_cover_type, plan_for_life, cellphone_type, about_partner, additional_information)
    SELECT
      p_student_id,
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
    DELETE FROM public.references WHERE student_id = p_student_id;
    INSERT INTO public.references (student_id, reference_type, name, phone, email)
    SELECT
      p_student_id,
      (x->>'reference_type')::reference_type_enum,
      x->>'name',
      x->>'phone',
      x->>'email'
    FROM jsonb_array_elements(payload->'references') x;
  END IF;

  IF payload->'previous_partners' IS NOT NULL AND jsonb_array_length(payload->'previous_partners') > 0 THEN
    DELETE FROM public.previous_partners WHERE student_id = p_student_id;
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, children, divorce_details)
    SELECT
      p_student_id,
      x->>'separation_type',
      x->>'full_name',
      (x->>'marriage_date')::date,
      (x->>'divorce_date')::date,
      (x->>'death_date')::date,
      -- יש רשימה: המספר נגזר ממנה. אין: המספר שנשלח (שורה ישנה בלי פרטים)
      CASE
        WHEN jsonb_typeof(x->'children') = 'array' AND jsonb_array_length(x->'children') > 0
          THEN jsonb_array_length(x->'children')
        ELSE (x->>'children_number')::int
      END,
      -- children חסר או אינו מערך (גם JSON null) נשמר כרשימה ריקה
      CASE
        WHEN jsonb_typeof(x->'children') = 'array' THEN x->'children'
        ELSE '[]'::jsonb
      END,
      x->'divorce_details'
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;


  IF payload ? 'education_history' AND (payload->'education_history' IS NULL OR payload->'education_history' = 'null'::jsonb) THEN
    DELETE FROM public.education_history WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'employment_history' AND (payload->'employment_history' IS NULL OR payload->'employment_history' = 'null'::jsonb) THEN
    DELETE FROM public.employment_history WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'medical_records' AND (payload->'medical_records' IS NULL OR payload->'medical_records' = 'null'::jsonb) THEN
    DELETE FROM public.medical_records WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'partner_preferences' AND (payload->'partner_preferences' IS NULL OR payload->'partner_preferences' = 'null'::jsonb) THEN
    DELETE FROM public.partner_preferences WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'references' AND (payload->'references' IS NULL OR payload->'references' = 'null'::jsonb) THEN
    DELETE FROM public.references WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'previous_partners' AND (payload->'previous_partners' IS NULL OR payload->'previous_partners' = 'null'::jsonb) THEN
    DELETE FROM public.previous_partners WHERE student_id = p_student_id;
  END IF;

  RETURN p_student_id;
END;
$function$;

ALTER FUNCTION public.update_full_student_profile(uuid, jsonb) OWNER TO postgres;

COMMENT ON FUNCTION public.update_full_student_profile(uuid, jsonb)
  IS 'עדכון כרטיס מיועד קיים. מותר לבעלים או לשדכן/מנהל. אינו משנה בעלות.';

REVOKE ALL ON FUNCTION public.update_full_student_profile(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_full_student_profile(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_full_student_profile(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_full_student_profile(uuid, jsonb) TO service_role;
