-- טופס השדכן האחיד: עיר מגורים, סוג השידוכים שבהם השדכן עוסק וטלפון הרב.
--
--  * shadchanim_info.match_types: בחירה מרובה מתוך רשימה סגורה (מפתחות באנגלית;
--    התוויות בעברית בקוד - features/shadchanim/lib/match-types.ts). NULL = לא
--    צוין (שדכנים ותיקים); מערך ריק אסור.
--  * shadchanim_info.rabbi_phone: טלפון של הרב (רב בית הכנסת). פרטי - נקרא רק
--    מהשורה עצמה (RLS: בעל השורה או מנהל), ואינו מוחזר באף פונקציה ציבורית.
--  * location ("עיר מגורים") קיימת; עכשיו חובה בבקשה ממתינה.
--  * assert_shadchan_application_complete: שלושת השדות חובה לבקשה ממתינה
--    (pending) בלבד, כמו מגדר/תאריך לידה - שדכנים מאושרים ותיקים אינם נחסמים
--    במסד (הטופס דורש אותם בשמירה הבאה). טלפון רב שהוזן - בכל סטטוס - חייב
--    להיות תקין (7-15 ספרות). מנהל ו-service role עוקפים, כמו קודם.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

-- ── 1. העמודות ───────────────────────────────────────────────────
ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS match_types text[],
  ADD COLUMN IF NOT EXISTS rabbi_phone text;

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_match_types_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_match_types_check
  CHECK (
    match_types IS NULL
    OR (
      cardinality(match_types) >= 1
      AND match_types <@ ARRAY[
        'young', 'older', 'divorced', 'widowed',
        'baalei_teshuva', 'special_needs', 'all'
      ]::text[]
    )
  );

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_rabbi_phone_length_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_rabbi_phone_length_check
  CHECK (rabbi_phone IS NULL OR char_length(rabbi_phone) <= 30);

COMMENT ON COLUMN public.shadchanim_info.match_types IS
  'סוגי השידוכים שבהם השדכן עוסק (young/older/divorced/widowed/baalei_teshuva/special_needs/all). חובה בבקשה ממתינה.';
COMMENT ON COLUMN public.shadchanim_info.rabbi_phone IS
  'טלפון של הרב (רב בית הכנסת). להנהלה ולשדכן עצמו בלבד - לא חלק מהפרופיל הציבורי. חובה בבקשה ממתינה.';

-- ── 2. בדיקת שלמות הבקשה ──────────────────────────────────────────
-- מ-20261029110000_shadchan_gender_birth_avatar.sql, עם עיר / סוגי שידוכים /
-- טלפון הרב כתוספת
CREATE OR REPLACE FUNCTION public.assert_shadchan_application_complete(
  p_row public.shadchanim_info
) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_phone_digits integer;
  v_rabbi_phone_digits integer;
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

  -- טלפון רב שהוזן חייב להיות תקין גם בשורה מאושרת
  IF p_row.rabbi_phone IS NOT NULL THEN
    v_rabbi_phone_digits := char_length(regexp_replace(p_row.rabbi_phone, '\D', '', 'g'));
    IF v_rabbi_phone_digits NOT BETWEEN 7 AND 15 THEN
      RAISE EXCEPTION 'shadchan_application_incomplete' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- שדכנים מאושרים ותיקים: אין להם מגדר/גיל/תמונה/עיר/סוגי שידוכים/טלפון רב,
  -- והעריכה שלהם לא נחסמת כאן
  IF p_row.application_status = 'pending'
     AND (p_row.gender IS NULL
          OR p_row.birth_date IS NULL
          OR (p_row.gender = 'male' AND p_row.avatar_path IS NULL)
          OR NULLIF(BTRIM(COALESCE(p_row.location, '')), '') IS NULL
          OR COALESCE(cardinality(p_row.match_types), 0) = 0
          OR p_row.rabbi_phone IS NULL) THEN
    RAISE EXCEPTION 'shadchan_application_incomplete' USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER FUNCTION public.assert_shadchan_application_complete(public.shadchanim_info) OWNER TO postgres;

-- ── Rollback (להריץ ידנית) ──
-- 1. להחזיר את assert_shadchan_application_complete להגדרה שב-20261029110000_shadchan_gender_birth_avatar.sql
-- 2. ALTER TABLE public.shadchanim_info DROP CONSTRAINT IF EXISTS shadchanim_info_match_types_check,
--      DROP CONSTRAINT IF EXISTS shadchanim_info_rabbi_phone_length_check;
-- 3. ALTER TABLE public.shadchanim_info DROP COLUMN IF EXISTS match_types, DROP COLUMN IF EXISTS rabbi_phone;
