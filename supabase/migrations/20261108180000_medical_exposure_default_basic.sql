-- הצהרה רפואית בלי רמת חשיפה מוצגת לשדכן כחשיפה בסיסית (ממצא 30).
--
-- עד עכשיו רמה שלא נבחרה (NULL) נחשבה לחשיפה מלאה: שדכן ראה את הפירוט ואת
-- המסמכים, אף שבעל הכרטיס לא בחר לחשוף אותם. הטופס אינו מחייב לבחור רמה, ולכן
-- ברירת המחדל הבטוחה היא "חשיפת רמת הבעיה בלבד עם פרטי יצירת קשר" - אותה
-- אפשרות שבטופס, והאמצעית בין הסתרה לחשיפה מלאה.
--
-- בפרודקשן: 164 הצהרות בלי רמה. 161 מהן ריקות (אין בעיה, פירוט או מסמכים),
-- כך שאין שינוי בתצוגה. ב-3 יש בעיה; באחת מהן פירוט, שמעכשיו מוצג רק לבעלים
-- ולמנהל.
--
-- גם update_full_student_profile משתנה: הצהרה בלי רמה היא עכשיו "מוגבלת",
-- ושדכן שעורך את הכרטיס (וקיבל לטופס את הגרסה המוסתרת) אינו דורס אותה.
--
-- ROLLBACK: להחיל מחדש את masked_medical_record
--           (20261027110000_medical_exposure_and_card_fields_rpcs.sql) ואת
--           update_full_student_profile (20261108110000_security_product_decisions.sql)

CREATE OR REPLACE FUNCTION public.masked_medical_record(mr public.medical_records) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  -- חדש: רמה שלא נבחרה = חשיפה בסיסית (בלי פירוט ובלי מסמכים)
  SELECT CASE COALESCE(mr.exposure_level, 'basic_exposure')
    WHEN 'no_exposure' THEN NULL
    WHEN 'only_for_kol_mitzhalot' THEN jsonb_build_object(
      'id', mr.id,
      'student_id', mr.student_id,
      'status', NULL,
      'exposure_level', mr.exposure_level,
      'details', NULL,
      'documents', NULL,
      'contact_info', NULL,
      'related_issue_preference', NULL
    )
    WHEN 'basic_exposure' THEN jsonb_build_object(
      'id', mr.id,
      'student_id', mr.student_id,
      'status', mr.status,
      'exposure_level', mr.exposure_level,
      'details', NULL,
      'documents', NULL,
      'contact_info', mr.contact_info,
      'related_issue_preference', mr.related_issue_preference
    )
    ELSE jsonb_build_object(
      'id', mr.id,
      'student_id', mr.student_id,
      'status', mr.status,
      'exposure_level', mr.exposure_level,
      'details', mr.details,
      'documents', mr.documents,
      'contact_info', mr.contact_info,
      'related_issue_preference', mr.related_issue_preference
    )
  END
  WHERE mr.id IS NOT NULL;
$$;

ALTER FUNCTION public.masked_medical_record(public.medical_records) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.masked_medical_record(public.medical_records) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_full_student_profile(p_student_id uuid, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_keep_medical boolean;
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

  -- כרטיס צד שלישי מוגבל אינו גלוי לשדכן, ולכן גם אינו נערך על ידו
  IF v_owner <> auth.uid() AND NOT public.is_admin()
     AND public.student_display_restricted(p_student_id) THEN
    RAISE EXCEPTION 'not_allowed'
      USING HINT = 'אין הרשאה לערוך כרטיס זה';
  END IF;

  -- הצהרה רפואית בחשיפה מוגבלת. שדכן שאינו בעל הכרטיס ואינו מנהל קיבל
  -- אותה מוסתרת (get_student_medical_record), ולכן מה שחזר מהטופס שלו אינו
  -- הרשומה המלאה - שמירה הייתה מוחקת את הפרטים. ההצהרה נשארת כמות שהיא.
  v_keep_medical := v_owner <> auth.uid()
    AND NOT COALESCE(public.is_admin(), false)
    AND EXISTS (
      SELECT 1 FROM public.medical_records mr
       WHERE mr.student_id = p_student_id
         -- חדש: רמה שלא נבחרה = חשיפה בסיסית, כמו ב-masked_medical_record
         AND COALESCE(mr.exposure_level, 'basic_exposure') <> 'full_exposure'
    );

  -- user_id לא נכלל: עריכה אינה מעבירה בעלות.
  UPDATE public.students SET
    in_shidduchim = COALESCE((payload->>'in_shidduchim')::boolean, true),
    first_name = payload->>'first_name',
    last_name = payload->>'last_name',
    nickname = payload->>'nickname',
    -- ערך ריק או חסר משאיר את הקיים: כרטיסים ישנים לא מאבדים את ה-ת"ז שלהם
    identity_number = COALESCE(NULLIF(payload->>'identity_number', ''), identity_number),
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
    institution_id = (payload->>'institution_id')::uuid,
    -- כרטיס ישן ללא card_for נשאר כך עד שהמשתמש בוחר בעריכה
    card_for = COALESCE(NULLIF(payload->>'card_for', ''), card_for),
    -- כהן - לגבר בלבד. קוד ישן שאינו שולח את המפתח משאיר את הקיים
    is_kohen = CASE
      WHEN payload->>'gender' IS DISTINCT FROM 'male' THEN NULL
      WHEN payload ? 'is_kohen' THEN (payload->>'is_kohen')::boolean
      ELSE is_kohen
    END,
    -- מוכן/ה לגור ב. מפתח חסר (קוד ישן) משאיר את הקיים
    willing_to_live_countries = CASE
      WHEN NOT payload ? 'willing_to_live_countries' THEN willing_to_live_countries
      WHEN jsonb_typeof(payload->'willing_to_live_countries') = 'array' THEN (
        SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'willing_to_live_countries') x
      )
      ELSE NULL
    END,
    -- חדש: שפת אם ושפות נוספות. מפתח חסר (קוד ישן) משאיר את הקיים
    native_language = CASE
      WHEN NOT payload ? 'native_language' THEN native_language
      ELSE NULLIF(btrim(payload->>'native_language'), '')
    END,
    languages = CASE
      WHEN NOT payload ? 'languages' THEN languages
      WHEN jsonb_typeof(payload->'languages') = 'array' THEN (
        SELECT array_agg(btrim(x)) FROM jsonb_array_elements_text(payload->'languages') x
         WHERE btrim(x) <> ''
      )
      ELSE NULL
    END
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

  IF payload->'medical_records' IS NOT NULL AND NOT v_keep_medical THEN
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
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, children, divorce_details, no_children)
    SELECT
      p_student_id,
      x->>'separation_type',
      x->>'full_name',
      (x->>'marriage_date')::date,
      (x->>'divorce_date')::date,
      (x->>'death_date')::date,
      -- יש רשימה: המספר נגזר ממנה. אין: המספר שנשלח (שורה ישנה בלי פרטים)
      CASE
        WHEN COALESCE((x->>'no_children')::boolean, false) THEN NULL
        WHEN jsonb_typeof(x->'children') = 'array' AND jsonb_array_length(x->'children') > 0
          THEN jsonb_array_length(x->'children')
        ELSE (x->>'children_number')::int
      END,
      -- children חסר או אינו מערך (גם JSON null) נשמר כרשימה ריקה
      CASE
        WHEN COALESCE((x->>'no_children')::boolean, false) THEN '[]'::jsonb
        WHEN jsonb_typeof(x->'children') = 'array' THEN x->'children'
        ELSE '[]'::jsonb
      END,
      x->'divorce_details',
      COALESCE((x->>'no_children')::boolean, false)
    FROM jsonb_array_elements(payload->'previous_partners') x;
  END IF;


  IF payload ? 'education_history' AND (payload->'education_history' IS NULL OR payload->'education_history' = 'null'::jsonb) THEN
    DELETE FROM public.education_history WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'employment_history' AND (payload->'employment_history' IS NULL OR payload->'employment_history' = 'null'::jsonb) THEN
    DELETE FROM public.employment_history WHERE student_id = p_student_id;
  END IF;
  IF payload ? 'medical_records' AND NOT v_keep_medical
     AND (payload->'medical_records' IS NULL OR payload->'medical_records' = 'null'::jsonb) THEN
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


