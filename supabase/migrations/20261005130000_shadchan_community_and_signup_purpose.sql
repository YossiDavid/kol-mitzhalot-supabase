-- בקשת הצטרפות כשדכן: נוספה "קהילה / חסידות" (אופציונלי).
--
-- הערך הוא שם הקהילה כפי שנבחר ממאגר public.communities (או הוזן בו
-- כחדש) - אותו מנגנון כמו בטופס הכרטיס, ולכן טקסט ולא מפתח זר:
-- כרטיסים ובקשות שהוזנו כטקסט חופשי נשארים תקפים.
--
-- "מטרת ההרשמה" (signup_purpose) נשמרת ב-user_metadata בלבד ואינה נוגעת
-- ב-DB - לכן אין כאן שינוי בטריגר ההרשמה.
--
-- אידמפוטנטית — ניתן להריץ שוב.

ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS community text;

COMMENT ON COLUMN public.shadchanim_info.community
  IS 'קהילה / חסידות של השדכן, כפי שנבחרה בטופס ההצטרפות (שם מתוך public.communities). null = לא צוינה';
