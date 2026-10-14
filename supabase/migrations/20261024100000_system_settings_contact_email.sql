-- "אימייל ליצירת קשר" בהגדרות האתר של המנהל, מוצג בכל תחתית דף.
--
-- system_settings החזיקה עד כה רק דגלים בוליאניים (value boolean NOT NULL).
-- מוסיפים עמודת text_value להגדרות טקסט, ו-value הופכת לרשות. כל שורה חייבת
-- להחזיק ערך אחד לפחות. ניקוי הגדרת טקסט = מחיקת השורה.
--
-- קריאה ציבורית (אנונימי) של המפתח הזה בלבד: פונקציית SECURITY DEFINER צרה,
-- ללא מדיניות SELECT חדשה לאנונימי על הטבלה (שאר ההגדרות נשארות סגורות).
-- כתיבה: רק service_role (פעולת השרת של המנהל, אחרי בדיקת תפקיד); למשתמשים
-- אין מדיניות INSERT/UPDATE/DELETE.
--
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS text_value text;

ALTER TABLE public.system_settings
  ALTER COLUMN value DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_settings_has_value'
      AND conrelid = 'public.system_settings'::regclass
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_has_value
      CHECK (value IS NOT NULL OR text_value IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'system_settings_text_value_len'
      AND conrelid = 'public.system_settings'::regclass
  ) THEN
    ALTER TABLE public.system_settings
      ADD CONSTRAINT system_settings_text_value_len
      CHECK (text_value IS NULL OR char_length(text_value) <= 254);
  END IF;
END $$;

COMMENT ON COLUMN public.system_settings.text_value
  IS 'ערך להגדרות טקסט (למשל contact_email); הגדרות דגל משתמשות ב-value';

CREATE OR REPLACE FUNCTION public.get_contact_email() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  SELECT s.text_value
  FROM public.system_settings s
  WHERE s.key = 'contact_email';
$$;

ALTER FUNCTION public.get_contact_email() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_contact_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contact_email() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_contact_email()
  IS 'האימייל הציבורי של המערכת (תחתית הדפים). המפתח היחיד של system_settings שנחשף לאנונימי.';

-- ── Rollback (להריץ ידנית) ──
-- DROP FUNCTION IF EXISTS public.get_contact_email();
-- DELETE FROM public.system_settings WHERE value IS NULL;
-- ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_has_value;
-- ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_text_value_len;
-- ALTER TABLE public.system_settings DROP COLUMN IF EXISTS text_value;
-- ALTER TABLE public.system_settings ALTER COLUMN value SET NOT NULL;
