-- תרומות דרך נדרים פלוס (iframe, שיטה 3) עם אישור תשלום מצד השרת:
--   1. donations: שורה לכל כוונת תרומה. ה-id הוא ה-Param2 שנשלח לספק, וה-ref
--      המספרי חוזר לספק כ-WEBDocID.
--   2. donation_payments: שורה לכל עדכון שהגיע מהספק (התשלום הראשון וכל חיוב
--      חודשי נוסף), כולל הגוף הגולמי.
--   3. record_nedarim_payment: התאמה וסימון "שולם" באופן אטומי ואידמפוטנטי.
--
-- הכתיבה נעשית רק מהשרת (service_role). מנהלים קוראים דרך RLS.
-- אידמפוטנטית - ניתן להריץ שוב בלי שגיאה.

-- ═══ 1. donations ══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- מספר סידורי קצר; חוזר לספק כ-WEBDocID
  ref bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'mismatch')),
  -- בשקלים שלמים כפי שהוזנו (לחודש בהוראת קבע)
  amount integer NOT NULL CHECK (amount > 0),
  -- 1 = שקל, 2 = דולר
  currency smallint NOT NULL DEFAULT 1 CHECK (currency IN (1, 2)),
  frequency text NOT NULL CHECK (frequency IN ('one_time', 'monthly')),
  dedication_type text,
  dedication_name text,
  -- הטקסט המורכב שנשלח לספק כהערה, למשל "לעילוי נשמת משה בן שרה"
  dedication_text text,
  donor_first_name text,
  donor_last_name text,
  donor_phone text,
  donor_email text,
  -- מזהה הוראת הקבע אצל הספק (KevaId), כשקיים
  provider_keva_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

COMMENT ON TABLE public.donations IS
  'כוונות תרומה (נדרים פלוס). id = Param2; status משתנה ל-paid רק מהקריאה החוזרת החתומה של הספק.';

CREATE INDEX IF NOT EXISTS donations_created_at_idx
  ON public.donations (created_at DESC);
CREATE INDEX IF NOT EXISTS donations_status_created_at_idx
  ON public.donations (status, created_at DESC);
CREATE INDEX IF NOT EXISTS donations_provider_keva_id_idx
  ON public.donations (provider_keva_id) WHERE provider_keva_id IS NOT NULL;

-- ═══ 2. donation_payments ═════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.donation_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- null = עדכון שלא הותאם לאף תרומה
  donation_id uuid REFERENCES public.donations (id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('transaction', 'keva_created')),
  -- null מותר בעדכון הקמת הוראת קבע (אין עסקה); אז הייחודיות לפי KevaId + kind
  provider_transaction_id text UNIQUE,
  provider_keva_id text,
  amount numeric,
  currency smallint,
  confirmation text,
  last4 text,
  -- הזמן כפי שהתקבל, ובנוסף תוצאת פענוח כשהצליח
  transaction_time text,
  transaction_time_parsed timestamptz,
  -- true = הותאם לתרומה ועבר בדיקת סכום/מטבע
  matched boolean NOT NULL DEFAULT false,
  mismatch_reason text,
  raw jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.donation_payments IS
  'עדכון אחד מהספק לכל שורה (עסקה או הקמת הוראת קבע). raw = הגוף כפי שהתקבל.';

-- הקמת הוראת קבע מגיעה פעם אחת לכל KevaId
-- עסקה זמנית: הספק שלח עדכון בלי מספר אישור (Confirmation) מ-Shva. עד שיגיע
-- עדכון נוסף לאותה עסקה עם אישור, התרומה נשארת "ממתין" והכסף לא אושר.
ALTER TABLE public.donation_payments
  ADD COLUMN IF NOT EXISTS is_temporary boolean NOT NULL DEFAULT false;
-- גופי העדכונים הקודמים לאותה עסקה (ישן ראשון), כש-raw עודכן בעדכון מאשר
ALTER TABLE public.donation_payments
  ADD COLUMN IF NOT EXISTS raw_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS donation_payments_keva_created_uniq
  ON public.donation_payments (provider_keva_id)
  WHERE kind = 'keva_created' AND provider_keva_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS donation_payments_donation_idx
  ON public.donation_payments (donation_id, received_at);
CREATE INDEX IF NOT EXISTS donation_payments_unmatched_idx
  ON public.donation_payments (received_at DESC) WHERE matched = false;

-- ═══ 3. RLS והרשאות ════════════════════════════════════════════════
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donations_select_admin" ON public.donations;
CREATE POLICY "donations_select_admin" ON public.donations
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "donation_payments_select_admin" ON public.donation_payments;
CREATE POLICY "donation_payments_select_admin" ON public.donation_payments
  FOR SELECT TO authenticated USING (public.is_admin());

-- אין מדיניות INSERT/UPDATE/DELETE ללקוח, וגם אין הרשאות טבלה
REVOKE ALL ON TABLE public.donations FROM PUBLIC;
REVOKE ALL ON TABLE public.donations FROM anon;
REVOKE ALL ON TABLE public.donations FROM authenticated;
GRANT SELECT ON TABLE public.donations TO authenticated;
GRANT ALL ON TABLE public.donations TO service_role;

REVOKE ALL ON TABLE public.donation_payments FROM PUBLIC;
REVOKE ALL ON TABLE public.donation_payments FROM anon;
REVOKE ALL ON TABLE public.donation_payments FROM authenticated;
GRANT SELECT ON TABLE public.donation_payments TO authenticated;
GRANT ALL ON TABLE public.donation_payments TO service_role;

-- ═══ 4. פענוח זמן עסקה ═════════════════════════════════════════════
-- הפורמט המדויק אצל הספק אינו מתועד: מנסים ISO ואז dd/mm/yyyy hh:mi[:ss]
-- (שעון ישראל). כישלון = null, והטקסט המקורי נשמר.
CREATE OR REPLACE FUNCTION public.parse_provider_time(p_text text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean text := btrim(coalesce(p_text, ''));
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;
  IF v_clean ~ '^\d{4}-\d{2}-\d{2}' THEN
    BEGIN
      RETURN v_clean::timestamptz;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;
  IF v_clean ~ '^\d{1,2}/\d{1,2}/\d{4} \d{1,2}:\d{2}(:\d{2})?$' THEN
    BEGIN
      RETURN (to_timestamp(v_clean, 'DD/MM/YYYY HH24:MI:SS')::timestamp)
        AT TIME ZONE 'Asia/Jerusalem';
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.parse_provider_time(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_provider_time(text) TO service_role;

-- ═══ 5. record_nedarim_payment ═════════════════════════════════════
-- מתעד עדכון מהספק, מתאים אותו לתרומה ומסמן "שולם" - הכול בטרנזקציה אחת.
--   * כפילות (אותו TransactionId / אותו KevaId להקמה): לא נוצרת שורה נוספת ואין
--     תופעות לוואי; מוחזר ה-ref של התרומה הקיימת.
--   * עסקה זמנית (p_is_temporary: כרטיס אשראי בלי Confirmation; ההחלטה מתקבלת
--     ב-TS): נרשמת, אבל התרומה נשארת pending. עדכון מאוחר לאותו TransactionId
--     עם אישור משדרג את השורה (מנקה את הדגל, שומר את ה-raw הישן ב-raw_history)
--     ואז מתאים ומסמן כרגיל. זו הדרך היחידה שבה שורה קיימת משתנה.
--   * התאמה: לפי Param2 (uuid של תרומה), ואם אין - לפי KevaId (חיוב חודשי נוסף).
--   * תרומה ממתינה: סכום ומטבע תואמים = paid, אחרת mismatch.
--   * תרומה שכבר טופלה: חיוב נוסף מתקבל רק אם ה-KevaId שלו הוא של התרומה.
-- מחזיר jsonb: {ref, matched, duplicate, temporary, status, reason}.

-- החתימה הקודמת (10 פרמטרים) מוחלפת באחת עם p_is_temporary
DROP FUNCTION IF EXISTS public.record_nedarim_payment(
  text, text, text, text, numeric, smallint, text, text, text, jsonb
);

CREATE OR REPLACE FUNCTION public.record_nedarim_payment(
  p_kind text,
  p_transaction_id text,
  p_keva_id text,
  p_param2 text,
  p_amount numeric,
  p_currency smallint,
  p_confirmation text,
  p_last4 text,
  p_transaction_time text,
  p_raw jsonb,
  p_is_temporary boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_donation public.donations%ROWTYPE;
  v_found boolean := false;
  v_matched boolean := false;
  v_reason text := NULL;
  v_payment_id uuid;
  v_existing public.donation_payments%ROWTYPE;
  v_new_status text := NULL;
  v_upgraded boolean := false;
BEGIN
  IF p_kind NOT IN ('transaction', 'keva_created') THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind;
  END IF;

  -- 1. מציאת התרומה (ונעילתה, כדי ששתי קריאות במקביל לא יסמנו פעמיים)
  IF p_param2 IS NOT NULL
     AND p_param2 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_donation FROM public.donations
      WHERE id = p_param2::uuid FOR UPDATE;
    v_found := FOUND;
  END IF;
  IF NOT v_found AND p_keva_id IS NOT NULL THEN
    SELECT * INTO v_donation FROM public.donations
      WHERE provider_keva_id = p_keva_id
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    v_found := FOUND;
  END IF;

  -- 2. החלטה
  IF p_kind = 'transaction' AND p_transaction_id IS NULL THEN
    v_reason := 'missing_transaction_id';
  ELSIF NOT v_found THEN
    v_reason := 'unknown_reference';
  ELSIF p_kind = 'keva_created' THEN
    v_matched := true;
    IF v_donation.provider_keva_id IS NOT NULL
       AND v_donation.provider_keva_id IS DISTINCT FROM p_keva_id THEN
      v_matched := false;
      v_reason := 'keva_id_conflict';
    END IF;
  ELSIF v_donation.status = 'pending' THEN
    IF p_currency IS DISTINCT FROM v_donation.currency THEN
      v_new_status := 'mismatch';
      v_reason := format('currency_mismatch: expected %s got %s',
        v_donation.currency, coalesce(p_currency::text, 'null'));
    ELSIF p_amount IS DISTINCT FROM v_donation.amount::numeric THEN
      v_new_status := 'mismatch';
      v_reason := format('amount_mismatch: expected %s got %s',
        v_donation.amount, coalesce(p_amount::text, 'null'));
    ELSIF p_is_temporary THEN
      -- שייך לתרומה אבל הכסף לא אושר: נשארת pending
      v_matched := true;
    ELSE
      v_new_status := 'paid';
      v_matched := true;
    END IF;
  ELSIF p_keva_id IS NOT NULL AND p_keva_id = v_donation.provider_keva_id THEN
    -- חיוב חודשי נוסף של הוראת קבע שכבר מוכרת
    v_matched := true;
  ELSE
    v_reason := 'reference_already_used';
  END IF;

  -- 3. רישום (כפילות = אין תופעות לוואי). היוצא מן הכלל: עדכון מאשר לעסקה
  -- שנרשמה כזמנית משדרג את השורה הקיימת. התרומה כבר נעולה למעלה, ולכן שתי
  -- קריאות מקבילות לאותה עסקה מתנהלות בזו אחר זו.
  IF p_kind = 'transaction' AND NOT p_is_temporary THEN
    SELECT * INTO v_existing FROM public.donation_payments
      WHERE provider_transaction_id = p_transaction_id FOR UPDATE;
    IF FOUND AND v_existing.is_temporary THEN
      UPDATE public.donation_payments
        SET donation_id = CASE WHEN v_found THEN v_donation.id END,
            provider_keva_id = coalesce(p_keva_id, provider_keva_id),
            amount = p_amount, currency = p_currency,
            confirmation = p_confirmation,
            last4 = coalesce(p_last4, last4),
            transaction_time = coalesce(p_transaction_time, transaction_time),
            transaction_time_parsed = coalesce(
              public.parse_provider_time(p_transaction_time),
              transaction_time_parsed),
            matched = v_matched, mismatch_reason = v_reason,
            is_temporary = false,
            raw_history = raw_history || jsonb_build_array(raw),
            raw = p_raw
        WHERE id = v_existing.id
        RETURNING id INTO v_payment_id;
      v_upgraded := true;
    END IF;
  END IF;

  IF v_upgraded THEN
    NULL;
  ELSIF p_kind = 'keva_created' THEN
    INSERT INTO public.donation_payments (
      donation_id, kind, provider_transaction_id, provider_keva_id, amount,
      currency, confirmation, last4, transaction_time, transaction_time_parsed,
      matched, mismatch_reason, raw
    ) VALUES (
      CASE WHEN v_found THEN v_donation.id END, p_kind, NULL, p_keva_id,
      p_amount, p_currency, p_confirmation, p_last4, p_transaction_time,
      public.parse_provider_time(p_transaction_time),
      v_matched, v_reason, p_raw
    )
    ON CONFLICT (provider_keva_id) WHERE kind = 'keva_created'
      AND provider_keva_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_payment_id;
  ELSE
    INSERT INTO public.donation_payments (
      donation_id, kind, provider_transaction_id, provider_keva_id, amount,
      currency, confirmation, last4, transaction_time, transaction_time_parsed,
      matched, mismatch_reason, raw, is_temporary
    ) VALUES (
      CASE WHEN v_found THEN v_donation.id END, p_kind, p_transaction_id,
      p_keva_id, p_amount, p_currency, p_confirmation, p_last4,
      p_transaction_time, public.parse_provider_time(p_transaction_time),
      v_matched, v_reason, p_raw, p_is_temporary
    )
    ON CONFLICT (provider_transaction_id) DO NOTHING
    RETURNING id INTO v_payment_id;
  END IF;

  IF v_payment_id IS NULL THEN
    IF p_kind = 'keva_created' THEN
      SELECT * INTO v_existing FROM public.donation_payments
        WHERE kind = 'keva_created' AND provider_keva_id = p_keva_id;
    ELSE
      SELECT * INTO v_existing FROM public.donation_payments
        WHERE provider_transaction_id = p_transaction_id;
    END IF;
    SELECT * INTO v_donation FROM public.donations
      WHERE id = v_existing.donation_id;
    RETURN jsonb_build_object(
      'ref', CASE WHEN v_existing.matched THEN v_donation.ref END,
      'matched', v_existing.matched,
      'duplicate', true,
      'temporary', v_existing.is_temporary,
      'status', v_donation.status,
      'reason', v_existing.mismatch_reason
    );
  END IF;

  -- 4. השפעה על התרומה (רק בעדכון חדש)
  IF v_found THEN
    IF v_new_status = 'paid' THEN
      UPDATE public.donations
        SET status = 'paid', paid_at = now(),
            provider_keva_id = coalesce(provider_keva_id, p_keva_id)
        WHERE id = v_donation.id;
    ELSIF v_new_status = 'mismatch' THEN
      UPDATE public.donations
        SET status = 'mismatch',
            provider_keva_id = coalesce(provider_keva_id, p_keva_id)
        WHERE id = v_donation.id;
    ELSIF p_kind = 'keva_created' AND v_matched THEN
      UPDATE public.donations
        SET provider_keva_id = coalesce(provider_keva_id, p_keva_id)
        WHERE id = v_donation.id;
    END IF;
    SELECT * INTO v_donation FROM public.donations WHERE id = v_donation.id;
  END IF;

  RETURN jsonb_build_object(
    'ref', CASE WHEN v_found AND v_matched THEN v_donation.ref END,
    'matched', v_matched,
    'duplicate', false,
    'temporary', p_is_temporary,
    'status', CASE WHEN v_found THEN v_donation.status END,
    'reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_nedarim_payment(
  text, text, text, text, numeric, smallint, text, text, text, jsonb, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_nedarim_payment(
  text, text, text, text, numeric, smallint, text, text, text, jsonb, boolean
) TO service_role;
