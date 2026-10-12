-- בקשת הצטרפות כשדכן: טלפון, קהילה ורב בית הכנסת הם שדות חובה (בקשת הלקוח).
--
--  * synagogue_rabbi: עמודה חדשה, nullable (לשורות קיימות אין ערך). נראית רק
--    לבעל הבקשה ולמנהל (RLS של shadchanim_info); פונקציות הפרופיל הציבורי
--    (shadchan_public_profiles / list_approved_shadchanim) בוחרות עמודות במפורש
--    ואינן כוללות אותה.
--  * אכיפה במסד: guard_application_decision (הטריגר הקיים trigger_guard_
--    shadchanim_info_decision) קורא ל-assert_shadchan_application_complete.
--    נבדקת רק שורה שנשארת/הופכת ל-pending בידי המבקש. מנהל ו-service role
--    (אישור/דחייה) עוקפים; שורות קיימות לא נוגעים בהן.
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS synagogue_rabbi text;

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_synagogue_rabbi_length_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_synagogue_rabbi_length_check
  CHECK (synagogue_rabbi IS NULL OR char_length(synagogue_rabbi) <= 100);

COMMENT ON COLUMN public.shadchanim_info.synagogue_rabbi IS
  'רב בית הכנסת של המבקש/ת - לבדיקת המנהל בלבד. לא חלק מהפרופיל הציבורי.';

-- בקשת הצטרפות של שדכן (ממתינה) חייבת טלפון, קהילה ורב בית הכנסת. נקראת מתוך
-- guard_application_decision, אחרי שהסטטוס נורמל: רק משתמש רגיל (לא מנהל, לא
-- service role) ורק כשהשורה נשארת/הופכת ל-pending. שורות קיימות לא נבדקות עד
-- שהמשתמש עצמו מגיש שוב. הטבלאות האחרות (staff_info) אינן מושפעות.
CREATE OR REPLACE FUNCTION public.assert_shadchan_application_complete(
  p_row public.shadchanim_info
) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_phone_digits integer;
BEGIN
  IF p_row.application_status IS DISTINCT FROM 'pending' THEN
    RETURN;
  END IF;

  v_phone_digits := char_length(regexp_replace(COALESCE(p_row.contact_phone, ''), '\D', '', 'g'));

  IF v_phone_digits NOT BETWEEN 7 AND 15
     OR NULLIF(BTRIM(COALESCE(p_row.community, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_row.synagogue_rabbi, '')), '') IS NULL THEN
    RAISE EXCEPTION 'shadchan_application_incomplete' USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER FUNCTION public.assert_shadchan_application_complete(public.shadchanim_info) OWNER TO postgres;

-- מ-20261007110000_security_hardening_2.sql, עם הקריאה ל-assert בלבד כתוספת
CREATE OR REPLACE FUNCTION public.guard_application_decision() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.application_status := 'pending';
    NEW.approved_at := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_reason := NULL;
    IF TG_TABLE_NAME = 'shadchanim_info' THEN
      PERFORM public.assert_shadchan_application_complete(NEW);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.application_status IS DISTINCT FROM OLD.application_status
     AND NOT (NEW.application_status = 'pending'
              AND (OLD.application_status IS NULL OR OLD.application_status = 'rejected'))
  THEN
    NEW.application_status := OLD.application_status;
  END IF;

  NEW.approved_at := OLD.approved_at;
  NEW.rejected_at := OLD.rejected_at;
  NEW.rejected_reason := OLD.rejected_reason;

  IF TG_TABLE_NAME = 'staff_info' AND OLD.application_status = 'approved' THEN
    NEW.institution_id := OLD.institution_id;
  END IF;

  IF TG_TABLE_NAME = 'shadchanim_info' THEN
    PERFORM public.assert_shadchan_application_complete(NEW);
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_application_decision() OWNER TO postgres;

-- ── Rollback (להריץ ידנית) ──
-- 1. להחזיר את guard_application_decision להגדרה שב-20261007110000_security_hardening_2.sql
-- 2. DROP FUNCTION IF EXISTS public.assert_shadchan_application_complete(public.shadchanim_info);
-- 3. ALTER TABLE public.shadchanim_info DROP CONSTRAINT IF EXISTS shadchanim_info_synagogue_rabbi_length_check;
-- 4. ALTER TABLE public.shadchanim_info DROP COLUMN IF EXISTS synagogue_rabbi;
