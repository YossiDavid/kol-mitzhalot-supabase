-- שדה "כהן" לכרטיס של גבר (תוספת בלבד, בטוח להחיל לפני הקוד).
--
-- NULL = לא צוין. הכלל "לכהן לא מציעים גרושה" נאכף בהצעות במיגרציה נפרדת.
-- אידמפוטנטית. להחלה: psql --single-transaction -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_kohen boolean;

COMMENT ON COLUMN public.students.is_kohen IS
  'האם המיועד כהן (לגברים בלבד). NULL = לא צוין.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_is_kohen_male_only'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_is_kohen_male_only
      CHECK (is_kohen IS NULL OR is_kohen = false OR gender = 'male');
  END IF;
END $$;
