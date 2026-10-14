-- מספר תעודת הזהות של המיועד/ת, שלב 2 מתוך 2: הערכים יוצאים מ-students.
--
-- דורש את 20261023100000_student_identity_side_table.sql. כאן:
--   1. העתקה חוזרת (ערכים שנכתבו בין השלבים), ואימות: אם ערך כלשהו ב-students
--      אינו זהה לזה שבטבלה הנפרדת - המיגרציה נעצרת בלי לשנות דבר.
--   2. students.identity_number מתרוקן. זו העברה ולא מחיקה: הערכים נמצאים
--      ב-student_identity_numbers, והחזרה היא שאילתה אחת (ראו rollback).
--   3. מעכשיו העמודה נשארת ריקה: כל כתיבה אליה (מה-RPC של הפרופיל, מכתיבה
--      ישירה, גם מ-service role) נשמרת כ-NULL. העמודה עצמה נשארת, כדי שקוד ישן
--      שמבקש "*" או שולח את המפתח ב-payload ימשיך לעבוד; הסרתה - בניקוי עתידי.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

DO $move$
DECLARE
  v_missing integer;
BEGIN
  INSERT INTO public.student_identity_numbers (student_id, identity_number)
  SELECT s.id, btrim(s.identity_number)
    FROM public.students s
   WHERE s.identity_number IS NOT NULL
     AND btrim(s.identity_number) <> ''
  ON CONFLICT (student_id) DO NOTHING;

  SELECT count(*) INTO v_missing
    FROM public.students s
    LEFT JOIN public.student_identity_numbers i ON i.student_id = s.id
   WHERE s.identity_number IS NOT NULL
     AND btrim(s.identity_number) <> ''
     AND i.identity_number IS DISTINCT FROM btrim(s.identity_number);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'identity_number_copy_mismatch: % rows', v_missing;
  END IF;

  -- רק השורות שיש בהן ערך; השינוי אינו נוגע בשום עמודה אחרת
  ALTER TABLE public.students DISABLE TRIGGER USER;
  UPDATE public.students
     SET identity_number = NULL
   WHERE identity_number IS NOT NULL;
  ALTER TABLE public.students ENABLE TRIGGER USER;
END
$move$;

COMMENT ON COLUMN public.students.identity_number IS
  'הוצא משימוש (20261023110000): תמיד ריק. הערכים שנאספו בעבר נמצאים ב-student_identity_numbers (בעלים ומנהלים בלבד)';

CREATE OR REPLACE FUNCTION public.keep_student_identity_number_empty() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.identity_number := NULL;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.keep_student_identity_number_empty() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.keep_student_identity_number_empty() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_keep_student_identity_number_empty ON public.students;
CREATE TRIGGER trigger_keep_student_identity_number_empty
  BEFORE INSERT OR UPDATE OF identity_number ON public.students
  FOR EACH ROW
  WHEN (NEW.identity_number IS NOT NULL)
  EXECUTE FUNCTION public.keep_student_identity_number_empty();

NOTIFY pgrst, 'reload schema';

-- ── rollback ─────────────────────────────────────────────────────────
-- מחזיר את הערכים ל-students (הטבלה הנפרדת נשארת; rollback של שלב 1 מוחק אותה).
--   DROP TRIGGER IF EXISTS trigger_keep_student_identity_number_empty ON public.students;
--   DROP FUNCTION IF EXISTS public.keep_student_identity_number_empty();
--   ALTER TABLE public.students DISABLE TRIGGER USER;
--   UPDATE public.students s
--      SET identity_number = i.identity_number
--     FROM public.student_identity_numbers i
--    WHERE i.student_id = s.id;
--   ALTER TABLE public.students ENABLE TRIGGER USER;
--   COMMENT ON COLUMN public.students.identity_number IS NULL;
--   NOTIFY pgrst, 'reload schema';
--
-- מחיקה סופית של מספרי ת.ז. (רק בהחלטה מפורשת של בעל המערכת; בלתי הפיכה):
--   DROP TABLE public.student_identity_numbers;
