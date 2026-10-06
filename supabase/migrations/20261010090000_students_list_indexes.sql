-- אינדקסים לרשימת המיועדים (/app/students), שנטענת בעמודים של 50 עם מיון
-- בשאילתה. שניהם חלקיים (deleted_at IS NULL) כמו כל שאילתות הרשימה, ו-id
-- בסוף כי הוא שובר השוויון הקבוע של המיון - כך Postgres עוצר אחרי 50
-- שורות במקום למיין את כל הטבלה.

-- מיון ברירת המחדל: א-ב לפי שם משפחה (ORDER BY last_name, id LIMIT 50)
CREATE INDEX IF NOT EXISTS students_list_last_name_idx
  ON public.students (last_name, id)
  WHERE deleted_at IS NULL;

-- מיון לפי גיל (birth_date, בסדר יורד/עולה דרך סריקה לאחור) וגם סינון
-- טווח גילאים (birth_date >= / <=)
CREATE INDEX IF NOT EXISTS students_list_birth_date_idx
  ON public.students (birth_date, id)
  WHERE deleted_at IS NULL;
