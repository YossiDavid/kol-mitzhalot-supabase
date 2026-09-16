-- כינוי המיועד/ת: שדה לא חובה בטופס, אחרי שם המשפחה.
--
-- שתי פונקציות השמירה (create_full_student_profile / update_full_student_profile)
-- מונות במפורש כל עמודה שנכתבת. העמודה נוספת כאן, והאם הפונקציות צריכות
-- שכתוב נבדק בפועל מיד אחרי ההרצה - ולא מונח מראש.
--
-- אידמפוטנטית - ניתן להריץ שוב.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS nickname text;

COMMENT ON COLUMN public.students.nickname IS 'כינוי המיועד/ת. שדה לא חובה בטופס, אחרי שם המשפחה';
