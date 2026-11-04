-- החלטות מוצר (4.11.2026) על ממצאי סקירת האבטחה:
-- 1. get_student_card_access: גישת "הצעה" רק בהצעה פתוחה. אחרי דחייה או
--    סגירה (rejected / completed) הצד השני כבר לא רואה את הכרטיס.
-- 2. set_student_photos: שדכן מוסיף ומסדר תמונות, אבל מחיקה - מנהל או בעל
--    הכרטיס בלבד.
-- 3. update_full_student_profile: שדכן עורך כרטיסים, אבל לא כרטיס צד שלישי
--    מוגבל (שאינו גלוי לו).
-- 4. get_student_staff_feedback: הערות הצוות אינן מוצגות בקישור הציבורי.
--
-- ROLLBACK: להריץ מחדש את ההגדרות הקודמות:
--   20261101100000_card_admin_exclusive.sql סעיף 6,
--   20260916100000_student_photo_gallery.sql סעיף 4,
--   20261102100000_students_languages.sql סעיף 2,
--   GRANT EXECUTE ON FUNCTION public.get_student_staff_feedback(uuid) TO anon;

-- ── 1 ──
CREATE OR REPLACE FUNCTION public.get_student_card_access(sid uuid)
 RETURNS TABLE(access_level text, share_contact boolean, share_medical boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  WITH target AS (
    SELECT s.id, s.user_id, s.admin_approved_at, s.admin_exclusive_at
    FROM public.students s
    WHERE s.id = sid AND s.deleted_at IS NULL
  ),
  proposal AS (
    -- bool_or על פני כל ההצעות הרלוונטיות: להורה עם שני ילדים יכולות
    -- להיות שתי הצעות על אותו כרטיס, והדגל הפתוח יותר גובר.
    -- שמות שונים משמות עמודות ה-RETURNS TABLE בכוונה: הפניה לא מוסמכת
    -- לשם זהה הייתה עלולה להיקרא כעמודת פלט ולא כעמודת ה-CTE.
    SELECT
      bool_or(true)                      AS p_has_access,
      bool_or(sh.share_contact_details)  AS p_share_contact,
      bool_or(sh.share_medical_info)     AS p_share_medical
    FROM public.shidduchim sh
    JOIN public.students me
      ON me.user_id = auth.uid()
     AND me.deleted_at IS NULL
    -- הצעה פתוחה בלבד: אחרי דחייה או סגירה הצד השני כבר לא רואה את הכרטיס
    WHERE sh.status::text NOT IN ('draft', 'rejected', 'completed')
      AND (
        (sh.bride_id = sid AND me.id = sh.groom_id
         AND sh.recipient_scope IN ('both', 'groom_only'))
        OR
        (sh.groom_id = sid AND me.id = sh.bride_id
         AND sh.recipient_scope IN ('both', 'bride_only'))
      )
  )
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN 'none'
      WHEN NOT EXISTS (SELECT 1 FROM target) THEN 'none'
      -- כרטיס שהנהלת המערכת לא אישרה (ממתין או נדחה): בעליו ומנהל בלבד. קודם
      -- לכל שאר הענפים, ולכן גם שדכן, איש צוות ומי שקיבל הצעה מקבלים 'none'.
      WHEN (SELECT admin_approved_at FROM target) IS NULL
        AND (SELECT user_id FROM target) IS DISTINCT FROM auth.uid()
        AND NOT COALESCE(public.is_admin(), false) THEN 'none'
      -- בעל הכרטיס, שדכן/מנהל ואיש צוות של המוסד רואים הכול ממילא,
      -- וקדימותם כאן מונעת הצרה מקרית של כרטיס שהם מורשים לו במלואו.
      WHEN (SELECT user_id FROM target) = auth.uid()
        OR COALESCE(public.is_admin(), false) THEN 'full'
      -- חדש: כרטיס בלעדי למנהל אינו במאגר - שדכן ואיש צוות רק דרך הצעה
      WHEN (SELECT admin_exclusive_at FROM target) IS NULL
        AND (public.is_shadchan_or_admin()
          OR public.staff_can_access_student(auth.uid(), sid)) THEN 'full'
      WHEN COALESCE((SELECT p_has_access FROM proposal), false) THEN 'proposal'
      ELSE 'none'
    END,
    COALESCE((SELECT p_share_contact FROM proposal), false),
    COALESCE((SELECT p_share_medical FROM proposal), false);
$function$;

-- ── 2 ──
CREATE OR REPLACE FUNCTION public.set_student_photos(p_student_id uuid, p_paths text[]) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  c_max_photos CONSTANT integer := 6;
  v_uid        uuid := auth.uid();
  v_owner_id   uuid;
  v_paths      text[] := COALESCE(p_paths, '{}');
  v_path       text;
  v_removed    text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING HINT = 'שמירת תמונות דורשת התחברות';
  END IF;

  SELECT s.user_id INTO v_owner_id
  FROM public.students s
  WHERE s.id = p_student_id AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student_not_found' USING HINT = 'הכרטיס לא נמצא';
  END IF;
  IF v_owner_id IS DISTINCT FROM v_uid AND NOT public.is_shadchan_or_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING HINT = 'אין הרשאה לעדכן את תמונות הכרטיס';
  END IF;
  -- מי שאינו רשאי לראות את התמונות (בת, בלי אישור צפייה) אינו רשאי גם
  -- לסדר, להסיר או להחליף אותן. בעלים ומנהל תמיד רשאים לראות.
  IF NOT public.can_view_student_photo(v_uid, p_student_id) THEN
    RAISE EXCEPTION 'not_allowed' USING HINT = 'אין הרשאה לעדכן תמונות שאינך רשאי לצפות בהן';
  END IF;
  -- הסרת תמונה: בעל הכרטיס או מנהל בלבד. שדכן רשאי להוסיף ולסדר.
  IF v_owner_id IS DISTINCT FROM v_uid AND NOT public.is_admin()
     AND EXISTS (SELECT 1 FROM public.student_photos p
                 WHERE p.student_id = p_student_id
                   AND NOT (p.storage_path = ANY (v_paths))) THEN
    RAISE EXCEPTION 'not_allowed' USING HINT = 'רק מנהל או בעל הכרטיס רשאים למחוק תמונות';
  END IF;
  IF cardinality(v_paths) > c_max_photos THEN
    RAISE EXCEPTION 'too_many_photos' USING HINT = format('ניתן לשמור עד %s תמונות', c_max_photos);
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(v_paths) AS x) <> cardinality(v_paths) THEN
    RAISE EXCEPTION 'duplicate_photo' USING HINT = 'אותה תמונה הופיעה פעמיים';
  END IF;

  FOREACH v_path IN ARRAY v_paths LOOP
    IF v_path IS NULL OR v_path LIKE '%..%' OR NOT (
         v_path LIKE p_student_id::text || '/photos/%'
      OR EXISTS (SELECT 1 FROM public.student_photos p
                 WHERE p.student_id = p_student_id AND p.storage_path = v_path)
    ) THEN
      RAISE EXCEPTION 'invalid_photo_path' USING HINT = 'נתיב תמונה לא תקין';
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(p.storage_path), '{}') INTO v_removed
  FROM public.student_photos p
  WHERE p.student_id = p_student_id
    AND NOT (p.storage_path = ANY (v_paths));

  DELETE FROM public.student_photos p
  WHERE p.student_id = p_student_id
    AND NOT (p.storage_path = ANY (v_paths));

  INSERT INTO public.student_photos (student_id, storage_path, position)
  SELECT p_student_id, x.path, (x.ord - 1)::integer
  FROM unnest(v_paths) WITH ORDINALITY AS x(path, ord)
  ON CONFLICT (student_id, storage_path) DO UPDATE SET position = EXCLUDED.position;

  RETURN v_removed;
END;
$$;

ALTER FUNCTION public.set_student_photos(uuid, text[]) OWNER TO postgres;

COMMENT ON FUNCTION public.set_student_photos(uuid, text[])
  IS 'מחליף את גלריית הכרטיס ברשימת הנתיבים (לפי הסדר; הראשון = הראשית). מחזיר את הנתיבים שהוסרו. בעלים/שדכן/מנהל.';

REVOKE ALL ON FUNCTION public.set_student_photos(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_student_photos(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_student_photos(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_student_photos(uuid, text[]) TO service_role;

-- ── 3 ──
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


-- ── 4 ──
REVOKE ALL ON FUNCTION public.get_student_staff_feedback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_staff_feedback(uuid) TO authenticated, service_role;
