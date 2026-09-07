-- טופס ההצטרפות כשדכן: נוסף "כמה שידוכים סגרתי".
--
-- השדות "כתובת אתר", "מיקום" ו"תעודות והסמכות" הוסרו מהטופס, אבל
-- העמודות website_url, location ו-certifications נשארות בטבלה
-- בכוונה — ייתכן שכבר יש בהן נתונים של שדכנים קיימים, ומחיקת עמודה
-- אינה הפיכה. אם יוחלט להיפרד מהן, זו מיגרציה נפרדת אחרי בדיקה
-- שהן ריקות.
--
-- אידמפוטנטית — ניתן להריץ שוב.

ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS closed_matches integer
    CHECK (closed_matches IS NULL OR closed_matches >= 0);

COMMENT ON COLUMN public.shadchanim_info.closed_matches
  IS 'כמה שידוכים השדכן סגר עד היום, לפי הצהרתו בטופס ההצטרפות';
