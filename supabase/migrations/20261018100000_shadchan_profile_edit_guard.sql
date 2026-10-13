-- עריכת פרופיל שדכן מאושר בידי עצמו (פריט 20): סגירת שני פערים בטריגר ההגנה.
--
--  * submitted_at לא היה מוגן: בעל שורה מאושרת יכול היה לשכתב אותו, והוא מזין את
--    since_year ("שדכן משנת") בפרופיל הציבורי. עכשיו עדכון בידי המשתמש עצמו
--    משמר את הערך הקיים כשהשורה מאושרת. מסלול ההגשה מחדש אחרי דחייה (rejected ->
--    pending) לא נפגע: הוא אינו מאושר, והטופס קובע submitted_at רק בהכנסה.
--  * טלפון / קהילה / רב בית הכנסת נאכפו רק לשורה ממתינה. עכשיו גם עדכון בידי
--    המשתמש עצמו של שורה מאושרת חייב להשאיר אותם תקינים (שורות ותיקות בלי הערכים
--    יידרשו להשלים אותם בשמירה הבאה, כמו בבקשות ממתינות ישנות).
--  מנהל ו-service role (auth.uid() IS NULL או is_admin()) ממשיכים לעקוף.
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

CREATE OR REPLACE FUNCTION public.assert_shadchan_application_complete(
  p_row public.shadchanim_info
) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_phone_digits integer;
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
END;
$$;

ALTER FUNCTION public.assert_shadchan_application_complete(public.shadchanim_info) OWNER TO postgres;

-- מ-20261017100000_shadchan_application_required_fields.sql, עם שימור submitted_at כתוספת
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
    IF OLD.application_status = 'approved' THEN
      NEW.submitted_at := OLD.submitted_at;
    END IF;
    PERFORM public.assert_shadchan_application_complete(NEW);
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.guard_application_decision() OWNER TO postgres;

-- ── Rollback (להריץ ידנית) ──
-- להחזיר את שתי הפונקציות להגדרות שב-20261017100000_shadchan_application_required_fields.sql
-- (assert: בדיקה רק כש-application_status = 'pending'; guard: בלי שימור submitted_at).
