-- רכישת פרנס היום / השבוע / החודש דרך דף התרומות:
--   1. dedication_prices: מחיר לכל סוג פרנס, שהמנהל קובע. אין מחיר = אין רכישה
--      (הקובייה הפנויה מפנה לתרומה רגילה, כמקודם). לא נזרעים מחירים.
--   2. donations.dedication_kind / dedication_starts_on / dedication_ends_on:
--      הפרנס שנרכש והתקופה שלו, קבועים בזמן יצירת הכוונה (השרת).
--   3. dedications.donation_id (ייחודי) ו-needs_review: הקדשה שנוצרה מתשלום.
--   4. dedication_slot_taken: האם יש הקדשה מפורסמת מאותו סוג החופפת לתקופה.
--   5. טריגר על donations: כשתרומה עם פרנס עוברת ל-paid (רק דרך
--      record_nedarim_payment; mismatch או עסקה זמנית אינם paid) נוצרת הקדשה,
--      פעם אחת לכל תרומה. אם המשבצת נתפסה בינתיים: ההקדשה נוצרת לא מפורסמת
--      ומסומנת לבדיקת המנהל, והתשלום נרשם כרגיל.
-- אידמפוטנטית - ניתן להריץ שוב בלי שגיאה. Rollback בסוף הקובץ (בהערות).

-- ═══ 1. dedication_prices ═════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.dedication_prices (
  kind       text PRIMARY KEY,
  -- בשקלים שלמים; הטווח המדויק (מינימום התרומה) נאכף גם באפליקציה
  amount     integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedication_prices_kind_check CHECK (
    kind IN ('sponsor_day', 'sponsor_week', 'sponsor_month')
  ),
  CONSTRAINT dedication_prices_amount_check CHECK (
    amount BETWEEN 1 AND 50000
  )
);

COMMENT ON TABLE public.dedication_prices IS
  'מחיר פרנס היום/השבוע/החודש. שורה חסרה = הקובייה מפנה לתרומה רגילה. נקבע על ידי המנהל בלבד.';

ALTER TABLE public.dedication_prices ENABLE ROW LEVEL SECURITY;

-- המחירים מוצגים באתר הציבורי
DROP POLICY IF EXISTS "dedication_prices_public_select" ON public.dedication_prices;
CREATE POLICY "dedication_prices_public_select" ON public.dedication_prices
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "dedication_prices_admin_all" ON public.dedication_prices;
CREATE POLICY "dedication_prices_admin_all" ON public.dedication_prices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.dedication_prices FROM PUBLIC, anon, authenticated;
GRANT SELECT (kind, amount) ON TABLE public.dedication_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dedication_prices TO authenticated;
GRANT ALL ON TABLE public.dedication_prices TO service_role;

-- ═══ 2. donations: הפרנס שנרכש ═════════════════════════════════════
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS dedication_kind text;
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS dedication_starts_on date;
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS dedication_ends_on date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'donations_dedication_kind_check'
      AND conrelid = 'public.donations'::regclass
  ) THEN
    ALTER TABLE public.donations
      ADD CONSTRAINT donations_dedication_kind_check CHECK (
        dedication_kind IS NULL
        OR dedication_kind IN ('sponsor_day', 'sponsor_week', 'sponsor_month')
      );
  END IF;
  -- פרנס: תקופה סגורה, חד־פעמית ועם שם להקדשה; בלי פרנס: בלי תקופה
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'donations_dedication_period_check'
      AND conrelid = 'public.donations'::regclass
  ) THEN
    ALTER TABLE public.donations
      ADD CONSTRAINT donations_dedication_period_check CHECK (
        (dedication_kind IS NULL
          AND dedication_starts_on IS NULL
          AND dedication_ends_on IS NULL)
        OR (dedication_kind IS NOT NULL
          AND dedication_starts_on IS NOT NULL
          AND dedication_ends_on IS NOT NULL
          AND dedication_ends_on >= dedication_starts_on
          AND frequency = 'one_time'
          AND dedication_type IS NOT NULL
          AND dedication_name IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.donations.dedication_kind IS
  'פרנס שנרכש בתרומה (sponsor_day/week/month). בתשלום מאושר נוצרת ממנו הקדשה באתר.';

-- ═══ 3. dedications: קישור לתרומה ═════════════════════════════════
ALTER TABLE public.dedications
  ADD COLUMN IF NOT EXISTS donation_id uuid
    REFERENCES public.donations (id) ON DELETE SET NULL;
ALTER TABLE public.dedications
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- הקדשה אחת לכל תרומה: גם קריאה חוזרת מהספק לא יוצרת שנייה
CREATE UNIQUE INDEX IF NOT EXISTS dedications_donation_id_uniq
  ON public.dedications (donation_id);

COMMENT ON COLUMN public.dedications.donation_id IS
  'התרומה שממנה נוצרה ההקדשה (רכישת פרנס). NULL = הוזנה ידנית על ידי המנהל.';
COMMENT ON COLUMN public.dedications.needs_review IS
  'נוצרה מתשלום אבל המשבצת כבר הייתה תפוסה: לא פורסמה, וממתינה להחלטת המנהל.';

COMMENT ON TABLE public.dedications IS
  'קוביות הקדשה באתר: פרנס היום/שבוע/חודש והנצחות. תוכן שהמנהל מזין, או שנוצר מרכישת פרנס ששולמה (donation_id)';

-- המנהל מנקה את הסימון כשהוא מטפל בהקדשה (פרסום / עריכה)
GRANT UPDATE (needs_review) ON TABLE public.dedications TO authenticated;

-- ═══ 4. האם המשבצת תפוסה ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.dedication_slot_taken(
  p_kind text,
  p_starts_on date,
  p_ends_on date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dedications d
    WHERE d.kind = p_kind
      AND d.is_published
      AND d.starts_on <= p_ends_on
      AND coalesce(d.ends_on, 'infinity'::date) >= p_starts_on
  );
$$;

REVOKE ALL ON FUNCTION public.dedication_slot_taken(text, date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dedication_slot_taken(text, date, date)
  TO service_role;

-- ═══ 5. יצירת ההקדשה בתשלום מאושר ═════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_dedication_for_paid_donation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_taken boolean;
  v_donor_line text;
BEGIN
  v_taken := public.dedication_slot_taken(
    NEW.dedication_kind, NEW.dedication_starts_on, NEW.dedication_ends_on);
  v_donor_line := nullif(left(btrim(concat_ws(' ',
    nullif(btrim(NEW.donor_first_name), ''),
    nullif(btrim(NEW.donor_last_name), ''))), 120), '');

  -- כשל ביצירת ההקדשה לעולם לא מבטל את רישום התשלום: נרשם כאזהרה בלבד
  BEGIN
    INSERT INTO public.dedications (
      kind, dedication_type, honoree, donor_line, starts_on, ends_on,
      is_published, needs_review, donation_id, created_by
    ) VALUES (
      NEW.dedication_kind, NEW.dedication_type, left(btrim(NEW.dedication_name), 120),
      v_donor_line, NEW.dedication_starts_on, NEW.dedication_ends_on,
      NOT v_taken, v_taken, NEW.id, NULL
    )
    ON CONFLICT (donation_id) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'dedication for donation % not created: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_dedication_for_paid_donation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_donation_paid_dedication ON public.donations;
CREATE TRIGGER trigger_donation_paid_dedication
  AFTER UPDATE OF status ON public.donations
  FOR EACH ROW
  WHEN (
    NEW.status = 'paid'
    AND OLD.status IS DISTINCT FROM 'paid'
    AND NEW.dedication_kind IS NOT NULL
  )
  EXECUTE FUNCTION public.create_dedication_for_paid_donation();

-- ---------------------------------------------------------------------------
-- ROLLBACK (להריץ ידנית אם צריך לבטל):
--   DROP TRIGGER IF EXISTS trigger_donation_paid_dedication ON public.donations;
--   DROP FUNCTION IF EXISTS public.create_dedication_for_paid_donation();
--   DROP FUNCTION IF EXISTS public.dedication_slot_taken(text, date, date);
--   DROP INDEX IF EXISTS public.dedications_donation_id_uniq;
--   ALTER TABLE public.dedications DROP COLUMN IF EXISTS needs_review;
--   ALTER TABLE public.dedications DROP COLUMN IF EXISTS donation_id;
--   ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_dedication_period_check;
--   ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_dedication_kind_check;
--   ALTER TABLE public.donations DROP COLUMN IF EXISTS dedication_ends_on;
--   ALTER TABLE public.donations DROP COLUMN IF EXISTS dedication_starts_on;
--   ALTER TABLE public.donations DROP COLUMN IF EXISTS dedication_kind;
--   DROP TABLE IF EXISTS public.dedication_prices;
-- ---------------------------------------------------------------------------
