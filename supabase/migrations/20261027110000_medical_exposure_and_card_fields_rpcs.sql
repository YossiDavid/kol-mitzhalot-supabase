-- רמת החשיפה של ההצהרה הרפואית נאכפת במסד, ושדות הכרטיס החדשים (כהן, מוכן/ה
-- לגור ב) נשמרים ומוחזרים.
--
-- עד כאן כל שדכן קרא את שורת medical_records במלואה, גם כשבעל הכרטיס בחר
-- "חשיפת פרטי הבעיה להנהלת קול מצהלות בלבד". RLS הוא ברמת שורה, ולכן:
--   1. קריאה ישירה של medical_records: בעל הכרטיס ומנהל בלבד.
--   2. שדכן (ומי שקיבל הצעה עם הצהרה פתוחה) מקבל את ההצהרה דרך
--      masked_medical_record, לפי רמת החשיפה:
--        full_exposure          - הכול.
--        basic_exposure         - רמת הבעיה (status), העדפה לשידוך ופרטי יצירת
--                                 קשר. בלי פירוט ובלי מסמכים.
--        only_for_kol_mitzhalot - רק עצם קיומה של הצהרה להנהלה (exposure_level).
--                                 בלי רמה, פירוט, מסמכים ופרטי קשר.
--        no_exposure            - כלום (NULL): בעל הכרטיס בחר להסתיר את עצם
--                                 קיומה של הבעיה.
--        NULL (לא נבחרה רמה)    - כמו full_exposure: כך הוצגה עד היום, ואין
--                                 בחירה של בעל הכרטיס להגביל.
--      get_student_medical_record - לכרטיס המלא ולמסך העריכה; get_proposal_student_card
--      - אותה הסתרה, ובלי contact_info כמו קודם.
--   3. update_full_student_profile: שדכן שאינו בעל הכרטיס ואינו מנהל אינו
--      משנה הצהרה בחשיפה מוגבלת (מה שקיבל לטופס אינו הרשומה המלאה).
--   4. create/update_full_student_profile: is_kohen ו-willing_to_live_countries.
-- גופי הפונקציות הועתקו מההגדרות האחרונות (20261005100000_card_for_and_no_children.sql,
-- 20261026090000_proposal_references_flag.sql); השינויים מסומנים "חדש".
-- דורש את 20261027100000_card_countries_and_admin_focus.sql.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

-- ── 1. ההסתרה לפי רמת החשיפה ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.masked_medical_record(mr public.medical_records) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE COALESCE(mr.exposure_level, 'full_exposure')
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
COMMENT ON FUNCTION public.masked_medical_record(public.medical_records) IS
  'ההצהרה הרפואית כפי שמי שאינו בעל הכרטיס או מנהל רואה אותה, לפי רמת החשיפה שנבחרה';
REVOKE ALL ON FUNCTION public.masked_medical_record(public.medical_records) FROM PUBLIC, anon, authenticated;

-- ── 2. ההצהרה לכרטיס המלא ולמסך העריכה ──────────────────────────────
-- בעל הכרטיס ומנהל: הרשומה המלאה. שדכן (כרטיס מאושר שאינו מוגבל לנתונים
-- בסיסיים): לפי רמת החשיפה. כל אחר (איש צוות, גולש, מי שקיבל הצעה): NULL.
CREATE OR REPLACE FUNCTION public.get_student_medical_record(p_student_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT CASE
    WHEN s.user_id = auth.uid() OR COALESCE(public.is_admin(), false)
      THEN to_jsonb(mr)
    WHEN COALESCE(public.is_shadchan_or_admin(), false)
         AND NOT public.student_hidden_until_approved(s.id)
         AND NOT public.student_display_restricted(s.id)
      THEN public.masked_medical_record(mr)
  END
    FROM public.students s
    JOIN public.medical_records mr ON mr.student_id = s.id
   WHERE s.id = p_student_id
     AND s.deleted_at IS NULL
     AND auth.uid() IS NOT NULL;
$$;

ALTER FUNCTION public.get_student_medical_record(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.get_student_medical_record(uuid) IS
  'ההצהרה הרפואית של כרטיס לצופה הנוכחי: מלאה לבעלים ולמנהל, מוסתרת לפי רמת החשיפה לשדכן, NULL לכל אחר';
REVOKE ALL ON FUNCTION public.get_student_medical_record(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_medical_record(uuid) TO authenticated;

-- ── 3. קריאה ישירה: בעל הכרטיס ומנהל בלבד ───────────────────────────
-- קודם: is_shadchan_or_admin() AND NOT student_display_restricted(...), או בעלים.
DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.medical_records;
DROP POLICY IF EXISTS "Medical records are read by owner and admin" ON public.medical_records;
CREATE POLICY "Medical records are read by owner and admin" ON public.medical_records
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.students s
       WHERE s.id = medical_records.student_id
         AND s.user_id = (SELECT auth.uid())
    )
  );

-- ── 4. פונקציות הפרופיל ──────────────────────────────────────────────
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
    user_id, in_shidduchim, first_name, last_name, nickname, identity_number, birth_date, gender,
    personal_status, height, phone, country, city, street, house, community,
    shtible, cellphone_type, plan_for_life, head_cover_type, image_url,
    cv_url, about, parents_info, family_info, author_info, institution_id, card_for,
    is_kohen, willing_to_live_countries
  )
  SELECT
    v_owner,
    COALESCE((payload->>'in_shidduchim')::boolean, true),
    payload->>'first_name',
    payload->>'last_name',
    payload->>'nickname',
    -- ת"ז כבר לא נאספת בטופס. מחרוזת ריקה לא נשמרת לעולם: העמודה UNIQUE,
    -- ו-'' בשני כרטיסים הייתה מתנגשת
    NULLIF(payload->>'identity_number', ''),
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
    (payload->>'institution_id')::uuid,
    NULLIF(payload->>'card_for', ''),
    -- חדש: כהן - לגבר בלבד (students_is_kohen_male_only). חסר = לא צוין
    CASE WHEN payload->>'gender' = 'male' THEN (payload->>'is_kohen')::boolean END,
    -- חדש: מוכן/ה לגור ב. רשימה ריקה או חסרה נשמרת NULL
    CASE WHEN jsonb_typeof(payload->'willing_to_live_countries') = 'array' THEN (
      SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'willing_to_live_countries') x
    ) END
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
    INSERT INTO public.previous_partners (student_id, separation_type, full_name, marriage_date, divorce_date, death_date, children_number, children, divorce_details, no_children)
    SELECT
      new_student_id,
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

  RETURN new_student_id;
END;
$function$;


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

  -- חדש: הצהרה רפואית בחשיפה מוגבלת. שדכן שאינו בעל הכרטיס ואינו מנהל קיבל
  -- אותה מוסתרת (get_student_medical_record), ולכן מה שחזר מהטופס שלו אינו
  -- הרשומה המלאה - שמירה הייתה מוחקת את הפרטים. ההצהרה נשארת כמות שהיא.
  v_keep_medical := v_owner <> auth.uid()
    AND NOT COALESCE(public.is_admin(), false)
    AND EXISTS (
      SELECT 1 FROM public.medical_records mr
       WHERE mr.student_id = p_student_id
         AND COALESCE(mr.exposure_level, 'full_exposure') <> 'full_exposure'
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
    -- חדש: כהן - לגבר בלבד. קוד ישן שאינו שולח את המפתח משאיר את הקיים
    is_kohen = CASE
      WHEN payload->>'gender' IS DISTINCT FROM 'male' THEN NULL
      WHEN payload ? 'is_kohen' THEN (payload->>'is_kohen')::boolean
      ELSE is_kohen
    END,
    -- חדש: מוכן/ה לגור ב. מפתח חסר (קוד ישן) משאיר את הקיים
    willing_to_live_countries = CASE
      WHEN NOT payload ? 'willing_to_live_countries' THEN willing_to_live_countries
      WHEN jsonb_typeof(payload->'willing_to_live_countries') = 'array' THEN (
        SELECT array_agg(x) FROM jsonb_array_elements_text(payload->'willing_to_live_countries') x
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

-- ── 5. הכרטיס בהצעה ──────────────────────────────────────────────────
-- הגוף מ-20261026090000_proposal_references_flag.sql; השינויים מסומנים "חדש".
CREATE OR REPLACE FUNCTION public.get_proposal_student_card(p_student_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  -- מי רשאי ומה נפתח לו: מקור אחד, get_student_card_access (לפי auth.uid()).
  -- רק מי שרואה את הכרטיס בזכות הצעה ('proposal') מקבל כאן תשובה; בעלים,
  -- שדכן, מנהל ואיש צוות קוראים את הטבלה עצמה, ומי שאין לו גישה מקבל NULL.
  -- מי רשאי: get_student_card_access (רק מי שרואה את הכרטיס בזכות הצעה). מה
  -- נפתח: get_proposal_cv_disclosure (קו"ח) והדגל הרפואי של אותה הכרעה.
  WITH gate AS (
    SELECT d.share_cv,
           d.share_references,
           d.legacy_share_contact,
           a.share_medical,
           -- כרטיס צד שלישי שלא אושר להצגה מלאה: נתונים בסיסיים בלבד
           public.student_display_restricted(p_student_id) AS basic_only
      FROM public.get_student_card_access(p_student_id) a
      JOIN public.get_proposal_card_disclosure(p_student_id) d ON true
     WHERE a.access_level = 'proposal'
  )
  SELECT
    jsonb_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'nickname', s.nickname,
      'gender', s.gender,
      'personal_status', s.personal_status,
      'birth_date', s.birth_date,
      'height', s.height,
      'country', s.country,
      'city', s.city,
      'community', s.community,
      'shtible', s.shtible,
      'plan_for_life', CASE WHEN g.basic_only THEN NULL ELSE s.plan_for_life END,
      'head_cover_type', CASE WHEN g.basic_only THEN NULL ELSE s.head_cover_type END,
      'about', CASE WHEN g.basic_only THEN NULL ELSE s.about END,
      'in_shidduchim', s.in_shidduchim,
      -- סוג הטלפון הוא העדפה ולא פרט התקשרות: מוצג תמיד למי שקיבל הצעה
      'cellphone_type', s.cellphone_type,
      -- כל הורה בלי טלפון ואימייל, תמיד; בכרטיס בסיסי שמות בלבד
      'parents_info', CASE
        WHEN s.parents_info IS NULL OR jsonb_typeof(s.parents_info) <> 'object' THEN NULL
        WHEN g.basic_only THEN jsonb_build_object(
          'father', jsonb_build_object('self', s.parents_info->'father'->'self'),
          'mother', jsonb_build_object('self', s.parents_info->'mother'->'self')
        )
        ELSE (
          SELECT COALESCE(
                   jsonb_object_agg(
                     e.key,
                     CASE WHEN jsonb_typeof(e.value) = 'object'
                          THEN e.value - 'phone' - 'email'
                          ELSE e.value END
                   ),
                   '{}'::jsonb
                 )
            FROM jsonb_each(s.parents_info) AS e(key, value)
        )
      END,
      'family_info', CASE WHEN g.basic_only THEN NULL ELSE s.family_info END,
      -- פרטי הממלא: בלי ההסבר "מדוע מילאתי" (מנהל וממלא בלבד), ובלי טלפון ואימייל
      'author_info', CASE
        WHEN s.author_info IS NULL OR jsonb_typeof(s.author_info) <> 'object' THEN NULL
        ELSE s.author_info - 'fillReason' - 'phone' - 'email'
      END,
      'card_for', s.card_for,
      'third_party_full_display_approved_at', s.third_party_full_display_approved_at,
      'third_party_proposals_approved_at', s.third_party_proposals_approved_at,
      -- חדש: כהן (פרט בסיסי) ומוכן/ה לגור ב (לא בכרטיס בסיסי)
      'is_kohen', s.is_kohen,
      'willing_to_live_countries', CASE WHEN g.basic_only THEN NULL
        ELSE s.willing_to_live_countries END,
      'education_history', COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', eh.id,
                   'student_id', eh.student_id,
                   'institution_type', eh.institution_type,
                   'name', eh.name,
                   'community', eh.community,
                   'city', eh.city
                 ) ORDER BY eh.id
               )
          FROM public.education_history eh
         WHERE eh.student_id = s.id
      ), '[]'::jsonb),
      'employment_history', COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', em.id,
                   'student_id', em.student_id,
                   'category', em.category,
                   'role', em.role,
                   'location', em.location,
                   'description', em.description
                 ) ORDER BY em.id
               )
          FROM public.employment_history em
         WHERE em.student_id = s.id
      ), '[]'::jsonb),
      'partner_preferences', CASE WHEN g.basic_only THEN NULL ELSE (
        SELECT jsonb_build_object(
                 'id', pp.id,
                 'student_id', pp.student_id,
                 'age_min', pp.age_min,
                 'age_max', pp.age_max,
                 'preferred_countries', pp.preferred_countries,
                 'work_status', pp.work_status,
                 'head_cover_type', pp.head_cover_type,
                 'plan_for_life', pp.plan_for_life,
                 'cellphone_type', pp.cellphone_type,
                 'about_partner', pp.about_partner,
                 'additional_information', pp.additional_information
               )
          FROM public.partner_preferences pp
         WHERE pp.student_id = s.id
      ) END,
      -- הטלפון של הרב שליווה את הגירושין הוא פרט התקשרות: אינו מוחזר
      'previous_partners', CASE WHEN g.basic_only THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', pr.id,
                   'student_id', pr.student_id,
                   'separation_type', pr.separation_type,
                   'full_name', pr.full_name,
                   'marriage_date', pr.marriage_date,
                   'divorce_date', pr.divorce_date,
                   'death_date', pr.death_date,
                   'children_number', pr.children_number,
                   'divorce_details', CASE
                     WHEN jsonb_typeof(pr.divorce_details) = 'object'
                       THEN pr.divorce_details - 'rabbiPhone'
                     ELSE pr.divorce_details
                   END,
                   'children', pr.children,
                   'no_children', pr.no_children
                 ) ORDER BY pr.id
               )
          FROM public.previous_partners pr
         WHERE pr.student_id = s.id
      ), '[]'::jsonb) END,
      -- ממליצים: שם וסוג תמיד; טלפון ואימייל רק כשהשדכן בחר לשתף את פרטי
      -- הממליצים בהצעה הזו
      'references', CASE WHEN g.basic_only THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(
                 CASE WHEN g.share_references THEN
                   jsonb_build_object(
                     'id', rf.id,
                     'reference_type', rf.reference_type,
                     'name', rf.name,
                     'phone', rf.phone,
                     'email', rf.email
                   )
                 ELSE
                   jsonb_build_object(
                     'id', rf.id,
                     'reference_type', rf.reference_type,
                     'name', rf.name
                   )
                 END ORDER BY rf.id
               )
          FROM public."references" rf
         WHERE rf.student_id = s.id
      ), '[]'::jsonb) END
    )
    -- קובץ הקו"ח: רק כשהשדכן בחר לשתף אותו בהצעה. טלפון, כתובת ופרטי קשר של
    -- המיועד/ת, ההורים והממלא אינם מוחזרים למי שקיבל הצעה - בשום דגל.
    || CASE WHEN g.share_cv THEN jsonb_build_object('cv_url', s.cv_url)
       ELSE '{}'::jsonb END
    -- תאימות לקוד ישן בלבד: בהצעה שנפתחה פעם בדגל הישן הקוד הקודם דורש את
    -- שלושת המפתחות האלה כדי לטעון את הכרטיס. הם חוזרים ריקים תמיד (אין בהם
    -- מידע), ויוסרו יחד עם העמודה share_contact_details.
    || CASE WHEN g.legacy_share_contact THEN
         jsonb_build_object('phone', NULL, 'street', NULL, 'house', NULL)
       ELSE '{}'::jsonb END
    -- הצהרה רפואית: רק כשנפתחה, ולעולם לא בכרטיס בסיסי. בלי contact_info - פרטי
    -- הקשר שבהצהרה (הורים או אנשי קשר אחרים) אינם מגיעים לצד השני.
    || CASE WHEN g.share_medical THEN
         jsonb_build_object(
           'medical_records', CASE WHEN g.basic_only THEN NULL ELSE (
             -- חדש: לפי רמת החשיפה שבחר בעל הכרטיס (masked_medical_record)
             SELECT public.masked_medical_record(mr) - 'contact_info'
               FROM public.medical_records mr
              WHERE mr.student_id = s.id
           ) END
         )
       ELSE '{}'::jsonb END
    FROM public.students s
   CROSS JOIN gate g
   WHERE s.id = p_student_id
     AND s.deleted_at IS NULL;
$$;

ALTER FUNCTION public.get_proposal_student_card(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_proposal_student_card(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal_student_card(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- מחזיר את הקריאה הישירה לכל שדכן (כלומר: את החשיפה שהמיגרציה סוגרת).
--   DROP POLICY IF EXISTS "Medical records are read by owner and admin" ON public.medical_records;
--   CREATE POLICY "Users read own students or shadchanim see all" ON public.medical_records
--     FOR SELECT USING (
--       (public.is_shadchan_or_admin() AND NOT public.student_display_restricted(student_id))
--       OR EXISTS (SELECT 1 FROM public.students s
--                   WHERE s.id = medical_records.student_id AND s.user_id = auth.uid())
--     );
--   -- ואז להריץ שוב את 20261005100000_card_for_and_no_children.sql (החלק של
--   -- הפונקציות) ואת 20261026090000_proposal_references_flag.sql (get_proposal_student_card)
--   DROP FUNCTION IF EXISTS public.get_student_medical_record(uuid);
--   DROP FUNCTION IF EXISTS public.masked_medical_record(public.medical_records);
--   NOTIFY pgrst, 'reload schema';
