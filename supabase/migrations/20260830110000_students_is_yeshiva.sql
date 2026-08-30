-- העמודה is_yeshiva נדרשת ע"י פילטר "ישיבה" ברשימת הכרטיסים
-- (features/students/components/filter.tsx → features/students/components/list.tsx),
-- אך מעולם לא הוגדרה באף מיגרציה. כתוצאה מכך שימוש בפילטר גרם ל-42703
-- ("column students.is_yeshiva does not exist") וכל הדף נכשל.
--
-- הערה: אין כרגע מסך שכותב לעמודה הזו, ולכן היא תישאר NULL ברשומות קיימות
-- והפילטר לא יחזיר תוצאות עד שיוזנו נתונים.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_yeshiva boolean;

COMMENT ON COLUMN public.students.is_yeshiva IS
  'האם הבחור לומד בישיבה. NULL = לא ידוע. משמש את פילטר החיפוש ברשימת הכרטיסים.';
