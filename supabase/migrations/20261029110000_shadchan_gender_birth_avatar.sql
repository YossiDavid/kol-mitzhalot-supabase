-- טופס ההצטרפות כשדכן: מגדר (שדכן / שדכנית), תאריך לידה (גיל 18-100) ותמונה.
-- התמונה חובה לשדכנים (בנים) ורשות לשדכניות.
--
--  * shadchanim_info.gender / birth_date / avatar_path: עמודות חדשות, nullable -
--    לשדכנים מאושרים קיימים אין ערכים, והעריכה שלהם לא נשברת במסד (הטופס
--    דורש אותם בשמירה הבאה).
--  * avatar_path: נתיב בתוך ה-bucket הפרטי shadchan-avatars, ותמיד בתיקייה של
--    בעל השורה (<user_id>/...). השרת חותם את הנתיב ב-service role, ולכן ה-CHECK
--    מבטיח שאי אפשר להצביע על קובץ של משתמש אחר.
--  * assert_shadchan_application_complete: לבקשה ממתינה (pending) מצד המבקש -
--    מגדר ותאריך לידה חובה, ותמונה חובה לשדכן (male). תאריך לידה שהוזן - גם
--    בשורה מאושרת - חייב להתאים לגיל 18-100. מנהל ו-service role עוקפים, כמו קודם.
--  * bucket shadchan-avatars: פרטי, 5MB, jpeg/png/webp. כתיבה/קריאה ישירה רק
--    לבעל התיקייה (auth.uid()) ולמנהל. שאר המשתמשים המחוברים רואים את התמונה
--    בקישור חתום שהשרת יוצר רק לשדכנים שה-RPC הציבורי מחזיר.
--  * shadchan_public_profiles: התמונה מ-avatar_path (ובהיעדרו - avatar_url
--    הישן מהמטא-דאטה), ועמודת gender חדשה בסוף. get_shadchan_public_profile
--    מחזירה גם gender (לכותרת "השדכן הרב" / "השדכנית גב'"). שינוי טיפוס
--    ההחזרה מחייב DROP + CREATE; ההרשאות וההערות משוחזרות זהות.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. העמודות ───────────────────────────────────────────────────
ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS avatar_path text;

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_gender_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

-- טווח סביר בלבד; בדיקת הגיל (תלויה בתאריך היום) נעשית ב-assert
ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_birth_date_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_birth_date_check
  CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_avatar_path_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_avatar_path_check
  CHECK (
    avatar_path IS NULL
    OR (
      split_part(avatar_path, '/', 1) = user_id::text
      AND avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,100}\.(jpg|jpeg|png|webp)$'
    )
  );

COMMENT ON COLUMN public.shadchanim_info.gender IS
  'שדכן (male) / שדכנית (female). חובה בבקשה ממתינה; לשדכנים ותיקים ריק.';
COMMENT ON COLUMN public.shadchanim_info.birth_date IS
  'תאריך לידה (גיל 18-100). להנהלה ולשדכן עצמו בלבד - לא חלק מהפרופיל הציבורי.';
COMMENT ON COLUMN public.shadchanim_info.avatar_path IS
  'נתיב התמונה ב-bucket הפרטי shadchan-avatars (<user_id>/<file>). חובה לשדכן (male) בבקשה ממתינה.';

-- ── 2. בדיקת שלמות הבקשה ──────────────────────────────────────────
-- מ-20261018100000_shadchan_profile_edit_guard.sql, עם מגדר / גיל / תמונה כתוספת
CREATE OR REPLACE FUNCTION public.assert_shadchan_application_complete(
  p_row public.shadchanim_info
) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_phone_digits integer;
  v_age integer;
BEGIN
  IF p_row.application_status IS DISTINCT FROM 'pending'
     AND p_row.application_status IS DISTINCT FROM 'approved' THEN
    RETURN;
  END IF;

  v_phone_digits := char_length(regexp_replace(COALESCE(p_row.contact_phone, ''), '\D', '', 'g'));

  IF v_phone_digits NOT BETWEEN 7 AND 15
     OR NULLIF(BTRIM(COALESCE(p_row.community, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_row.synagogue_rabbi, '')), '') IS NULL THEN
    RAISE EXCEPTION 'shadchan_application_incomplete' USING ERRCODE = '23514';
  END IF;

  IF p_row.birth_date IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM age(current_date, p_row.birth_date))::integer;
    IF v_age NOT BETWEEN 18 AND 100 THEN
      RAISE EXCEPTION 'shadchan_age_out_of_range' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- שדכנים מאושרים ותיקים: אין להם מגדר/גיל/תמונה, והעריכה שלהם לא נחסמת כאן
  IF p_row.application_status = 'pending'
     AND (p_row.gender IS NULL
          OR p_row.birth_date IS NULL
          OR (p_row.gender = 'male' AND p_row.avatar_path IS NULL)) THEN
    RAISE EXCEPTION 'shadchan_application_incomplete' USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER FUNCTION public.assert_shadchan_application_complete(public.shadchanim_info) OWNER TO postgres;

-- ── 3. ה-bucket והרשאות האחסון ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shadchan-avatars',
  'shadchan-avatars',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "shadchan_avatars_select_own_or_admin" ON storage.objects;
CREATE POLICY "shadchan_avatars_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'shadchan-avatars'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
         OR (SELECT public.is_admin()))
  );

DROP POLICY IF EXISTS "shadchan_avatars_insert_own_or_admin" ON storage.objects;
CREATE POLICY "shadchan_avatars_insert_own_or_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shadchan-avatars'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
         OR (SELECT public.is_admin()))
  );

DROP POLICY IF EXISTS "shadchan_avatars_update_own_or_admin" ON storage.objects;
CREATE POLICY "shadchan_avatars_update_own_or_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shadchan-avatars'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
         OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    bucket_id = 'shadchan-avatars'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
         OR (SELECT public.is_admin()))
  );

DROP POLICY IF EXISTS "shadchan_avatars_delete_own_or_admin" ON storage.objects;
CREATE POLICY "shadchan_avatars_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shadchan-avatars'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
         OR (SELECT public.is_admin()))
  );

-- ── 4. shadchan_public_profiles ───────────────────────────────────
-- מ-20261021100000_contact_details_at_source.sql: התמונה מ-avatar_path קודם,
-- ו-gender בסוף. avatar_url מחזירה אחד משניים - נתיב ב-shadchan-avatars (בלי
-- "http") שהשרת חותם, או קישור מלא ישן מהמטא-דאטה.
DROP FUNCTION IF EXISTS public.shadchan_public_profiles(uuid[]);
CREATE FUNCTION public.shadchan_public_profiles(p_ids uuid[])
RETURNS TABLE (
  shadchan_id      uuid,
  first_name       text,
  last_name        text,
  avatar_url       text,
  since_year       integer,
  phone            text,
  email            text,
  city             text,
  description      text,
  experience_years integer,
  closed_matches   integer,
  specializations  text[],
  languages        text[],
  gender           text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT
    u.id,
    COALESCE(NULLIF(BTRIM(p.first_name), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'firstName'), '')),
    COALESCE(NULLIF(BTRIM(p.last_name), ''),  NULLIF(BTRIM(u.raw_user_meta_data->>'lastName'), '')),
    COALESCE(si.avatar_path, NULLIF(BTRIM(u.raw_user_meta_data->>'avatar_url'), '')),
    CASE
      WHEN si.experience_years IS NOT NULL AND si.experience_years >= 0 THEN
        EXTRACT(YEAR FROM COALESCE(si.submitted_at, si.created_at))::integer - si.experience_years
      ELSE
        EXTRACT(YEAR FROM COALESCE(si.approved_at, si.submitted_at, si.created_at, u.created_at))::integer
    END,
    CASE WHEN auth.uid() = u.id OR public.is_admin()
         THEN NULLIF(BTRIM(si.contact_phone), '') END,
    CASE WHEN auth.uid() = u.id OR public.is_admin()
         THEN NULLIF(BTRIM(si.contact_email), '') END,
    NULLIF(BTRIM(si.location), ''),
    NULLIF(BTRIM(si.bio), ''),
    si.experience_years,
    si.closed_matches,
    COALESCE(si.specializations, '{}'),
    COALESCE(si.languages, '{}'),
    si.gender
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN public.shadchanim_info si ON si.user_id = u.id
  WHERE u.id = ANY (p_ids);
$$;

ALTER FUNCTION public.shadchan_public_profiles(uuid[]) OWNER TO postgres;

COMMENT ON FUNCTION public.shadchan_public_profiles(uuid[])
  IS 'פנימית: שדות הכרטיס הציבורי של שדכנים. טלפון ואימייל רק לשדכן עצמו ולמנהל. ההרשאה נבדקת בפונקציות שקוראות לה.';

REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.shadchan_public_profiles(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shadchan_public_profiles(uuid[]) TO service_role;

-- ── 5. get_shadchan_public_profile ────────────────────────────────
-- מ-20261021090000_shadchan_contact_private.sql, עם gender בסוף
DROP FUNCTION IF EXISTS public.get_shadchan_public_profile(uuid);
CREATE FUNCTION public.get_shadchan_public_profile(p_shadchan_id uuid)
RETURNS TABLE (
  shadchan_id      uuid,
  first_name       text,
  last_name        text,
  avatar_url       text,
  since_year       integer,
  phone            text,
  email            text,
  city             text,
  description      text,
  experience_years integer,
  closed_matches   integer,
  specializations  text[],
  languages        text[],
  gender           text
)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  SELECT pp.shadchan_id, pp.first_name, pp.last_name, pp.avatar_url, pp.since_year,
         CASE WHEN auth.uid() = pp.shadchan_id OR public.is_admin()
              THEN pp.phone END,
         CASE WHEN auth.uid() = pp.shadchan_id OR public.is_admin()
              THEN pp.email END,
         pp.city, pp.description, pp.experience_years, pp.closed_matches,
         pp.specializations, pp.languages, pp.gender
  FROM public.shadchan_public_profiles(ARRAY[p_shadchan_id]) pp
  WHERE auth.uid() IS NOT NULL
    AND public.is_contactable_shadchan(p_shadchan_id);
$$;

ALTER FUNCTION public.get_shadchan_public_profile(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.get_shadchan_public_profile(uuid)
  IS 'הכרטיס הציבורי של שדכן, למשתמש מחובר. טלפון ואימייל רק לשדכן עצמו ולמנהל, לאחרים NULL. ריק אם המזהה אינו של שדכן.';

REVOKE ALL ON FUNCTION public.get_shadchan_public_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shadchan_public_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shadchan_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shadchan_public_profile(uuid) TO service_role;

-- ── Rollback (להריץ ידנית) ──
-- 1. get_shadchan_public_profile: DROP ולהחזיר את ההגדרה שב-20261021090000_shadchan_contact_private.sql
-- 2. shadchan_public_profiles: DROP ולהחזיר את ההגדרה שב-20261021100000_contact_details_at_source.sql
-- 3. assert_shadchan_application_complete: להחזיר את ההגדרה שב-20261018100000_shadchan_profile_edit_guard.sql
-- 4. DROP POLICY "shadchan_avatars_*" ON storage.objects; ומחיקת ה-bucket shadchan-avatars (אחרי ריקון)
-- 5. ALTER TABLE public.shadchanim_info DROP COLUMN IF EXISTS avatar_path,
--      DROP COLUMN IF EXISTS birth_date, DROP COLUMN IF EXISTS gender;
