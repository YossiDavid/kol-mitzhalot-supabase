-- קוביות הקדשה והנצחה באתר הציבורי: פרנס היום / השבוע / החודש והנצחות.
-- המנהל מזין טקסט ותאריכים; קובייה מוצגת רק בתקופתה (לפי יום קלנדרי בישראל).
-- Callers: ניהול /app/admin/content/dedications (כתיבה כמנהל), דף הבית ודף
--   התרומות (קריאה אנונימית דרך lib/dedications.ts).
-- אינה קשורה לתשלומים: טבלאות donations / donation_payments אינן נוגעות בה.
-- אידמפוטנטי. Rollback בסוף הקובץ (בהערות).

-- ---------------------------------------------------------------------------
-- 1. "היום" בישראל. השרת והמסד ב-UTC, ולכן קובייה ליום מסוים הייתה נעלמת
--    בשעה 02:00-03:00 בלילה לפני חצות ישראלי. מקור יחיד גם ל-RLS וגם לאפליקציה.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.israel_today() RETURNS date
  LANGUAGE sql STABLE
  AS $$ SELECT (now() AT TIME ZONE 'Asia/Jerusalem')::date $$;

GRANT EXECUTE ON FUNCTION public.israel_today() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. הטבלה
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dedications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL,
  dedication_type text,
  honoree        text NOT NULL,
  donor_line     text,
  note           text,
  starts_on      date NOT NULL,
  ends_on        date,
  is_published   boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedications_kind_check CHECK (
    kind IN ('sponsor_day', 'sponsor_week', 'sponsor_month', 'memorial')
  ),
  CONSTRAINT dedications_type_check CHECK (
    dedication_type IS NULL
    OR dedication_type IN ('לעילוי נשמת', 'לרפואת', 'לזכות', 'להצלחת')
  ),
  CONSTRAINT dedications_honoree_length_check CHECK (
    char_length(btrim(honoree)) BETWEEN 1 AND 120
  ),
  CONSTRAINT dedications_donor_line_length_check CHECK (
    donor_line IS NULL OR char_length(btrim(donor_line)) BETWEEN 1 AND 120
  ),
  CONSTRAINT dedications_note_length_check CHECK (
    note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 200
  ),
  -- ללא קישורים ותגיות תמונה, כמו בהערות התרומה (features/donations/lib/nedarim.ts)
  CONSTRAINT dedications_no_links_check CHECK (
    honoree !~* '(http|www|<img|src=)'
    AND coalesce(donor_line, '') !~* '(http|www|<img|src=)'
    AND coalesce(note, '') !~* '(http|www|<img|src=)'
  ),
  CONSTRAINT dedications_dates_order_check CHECK (
    ends_on IS NULL OR ends_on >= starts_on
  ),
  -- הנצחה יכולה להיות פתוחה (ends_on ריק = עד הסרה); פרנס תמיד בתקופה סגורה
  CONSTRAINT dedications_sponsor_needs_end_check CHECK (
    kind = 'memorial' OR ends_on IS NOT NULL
  ),
  CONSTRAINT dedications_sort_order_check CHECK (sort_order BETWEEN 0 AND 100000)
);

COMMENT ON TABLE public.dedications IS
  'קוביות הקדשה באתר: פרנס היום/שבוע/חודש והנצחות. תוכן שהמנהל מזין, לא נוצר מתשלומים';
COMMENT ON COLUMN public.dedications.ends_on IS
  'היום האחרון להצגה (כולל), לפי יום ישראלי. NULL = הנצחה פתוחה עד הסרה';

-- שאילתת "הקיימות היום": רק מפורסמות, לפי תאריך התחלה וסיום
CREATE INDEX IF NOT EXISTS idx_dedications_current
  ON public.dedications (starts_on, ends_on) WHERE is_published;
-- רשימת הניהול: לפי סוג וסדר
CREATE INDEX IF NOT EXISTS idx_dedications_kind_sort
  ON public.dedications (kind, sort_order, starts_on);
CREATE INDEX IF NOT EXISTS idx_dedications_created_by
  ON public.dedications (created_by) WHERE created_by IS NOT NULL;

-- updated_at
CREATE OR REPLACE FUNCTION public.update_dedications_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_dedications_updated_at ON public.dedications;
CREATE TRIGGER trigger_update_dedications_updated_at
  BEFORE UPDATE ON public.dedications
  FOR EACH ROW EXECUTE FUNCTION public.update_dedications_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS: הציבור קורא רק מפורסם ובתוקף היום (שעון ישראל); מנהל עושה הכול
-- ---------------------------------------------------------------------------
ALTER TABLE public.dedications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dedications_public_select_current" ON public.dedications;
CREATE POLICY "dedications_public_select_current" ON public.dedications
  FOR SELECT TO anon, authenticated
  USING (
    is_published
    AND starts_on <= public.israel_today()
    AND (ends_on IS NULL OR ends_on >= public.israel_today())
  );

DROP POLICY IF EXISTS "dedications_admin_all" ON public.dedications;
CREATE POLICY "dedications_admin_all" ON public.dedications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. הרשאות מינימליות. בלי INSERT/UPDATE לעמודות id, created_by, תאריכי מערכת
--    (created_by מתמלא מ-auth.uid() ברירת מחדל)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.dedications FROM PUBLIC, anon, authenticated;
-- אנונימי רואה רק עמודות תצוגה (לא created_by); מחובר (מנהל) רואה הכול
GRANT SELECT (id, kind, dedication_type, honoree, donor_line, note, starts_on,
              ends_on, sort_order)
  ON TABLE public.dedications TO anon;
GRANT SELECT ON TABLE public.dedications TO authenticated;
GRANT INSERT (kind, dedication_type, honoree, donor_line, note, starts_on,
              ends_on, is_published, sort_order)
  ON TABLE public.dedications TO authenticated;
GRANT UPDATE (kind, dedication_type, honoree, donor_line, note, starts_on,
              ends_on, is_published, sort_order)
  ON TABLE public.dedications TO authenticated;
GRANT DELETE ON TABLE public.dedications TO authenticated;
GRANT ALL ON TABLE public.dedications TO service_role;

-- ---------------------------------------------------------------------------
-- ROLLBACK (להריץ ידנית אם צריך לבטל):
--   DROP TABLE IF EXISTS public.dedications;
--   DROP FUNCTION IF EXISTS public.update_dedications_updated_at();
--   DROP FUNCTION IF EXISTS public.israel_today();
-- ---------------------------------------------------------------------------
