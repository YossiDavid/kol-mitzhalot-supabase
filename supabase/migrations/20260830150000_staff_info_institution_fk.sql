-- מחליף את העמודה החופשית staff_info.institution (טקסט חופשי) בקישור
-- institution_id למאגר המוסדות המנוהל (public.institutions), מקביל לחיבור
-- students.institution_id שנוצר ב-20260830140000_institutions.sql.
-- הסיבה: התאמת אנשי צוות למיועדים לפי מוסד לימודים דורשת מזהה יציב
-- (institution_id) ולא טקסט חופשי שעלול להיכתב בכמה איותים שונים לאותו מוסד.
--
-- המיגרציה חייבת לעבוד בין אם 20260830130000_create_staff_info_table.sql
-- כבר הורצה ובין אם לא (עדיין לא הוחל על מסד הנתונים בענן), ולכן משתמשת
-- ב-ADD COLUMN IF NOT EXISTS / DROP COLUMN IF EXISTS כדי להיות אידמפוטנטית.
--
-- מחיקת העמודה institution בטוחה: הטבלה staff_info מעולם לא נפרסה בענן,
-- ולכן אין בה נתונים קיימים שעלולים ללכת לאיבוד.

ALTER TABLE public.staff_info
  ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.staff_info.institution_id IS 'מוסד הלימודים אליו משתייך איש הצוות, מתוך מאגר המוסדות המנוהל ע"י מנהל המערכת. NULL אם לא נבחר מוסד.';

ALTER TABLE public.staff_info DROP COLUMN IF EXISTS institution;

CREATE INDEX IF NOT EXISTS idx_staff_info_institution_id ON public.staff_info (institution_id);
