-- עדכוני שגיאה מנדרים פלוס (Status = Error, בלי TransactionId): הספק שולח אותם אל
-- ה-CallBack של העסקה כשתשלום נדחה (למשל "NEED ZEOUT"). התרומה נשארת pending כדי
-- שהתורם יוכל לנסות שוב; רק נרשם שהניסיון האחרון נכשל, כדי שהמנהל יראה זאת.
--   1. donations.last_error / last_error_at: הודעת הספק והזמן.
--   2. record_donation_error: עדכון השדות, מהשרת בלבד (service_role).
-- אידמפוטנטית - ניתן להריץ שוב בלי שגיאה.

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

COMMENT ON COLUMN public.donations.last_error IS
  'הודעת השגיאה האחרונה מהספק (עדכון Status=Error). התרומה נשארת pending; תשלום מאוחר מסמן paid.';

-- מחזיר true כשנמצאה תרומה ממתינה שהתעדכנה. Param2 שאינו uuid, תרומה לא קיימת
-- או כזו שכבר אינה pending: לא משנים דבר ומחזירים false.
CREATE OR REPLACE FUNCTION public.record_donation_error(
  p_param2 text,
  p_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_param2 IS NULL
     OR p_param2 !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  UPDATE public.donations
    SET last_error = left(coalesce(nullif(btrim(p_message), ''), 'Error'), 200),
        last_error_at = now()
    WHERE id = p_param2::uuid AND status = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.record_donation_error(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_donation_error(text, text)
  TO service_role;

-- ═══ record_nedarim_payment: סכום/מטבע חסרים אינם אי-התאמה ══════════
-- אותה פונקציה (אותה חתימה) כמו במיגרציית התרומות, עם שינוי יחיד בהחלטה: בתרומה
-- ממתינה, סכום או מטבע שלא הגיעו בעדכון אינם mismatch (התשלום נרשם עם null).
-- כשהם הגיעו הם חייבים להתאים, כמקודם. הרישום, האידמפוטנטיות, עסקה זמנית והוראת
-- קבע (הקמה לפי Param2, חיוב מאוחר לפי KevaId) ללא שינוי.
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
    -- סכום או מטבע חסרים בעדכון (התיעוד אינו מבטיח אותם): לא mismatch, ומקבלים
    -- על סמך חתימה ו-Param2. כשהם קיימים הם חייבים להתאים.
    IF p_currency IS NOT NULL AND p_currency IS DISTINCT FROM v_donation.currency THEN
      v_new_status := 'mismatch';
      v_reason := format('currency_mismatch: expected %s got %s',
        v_donation.currency, coalesce(p_currency::text, 'null'));
    ELSIF p_amount IS NOT NULL
          AND p_amount IS DISTINCT FROM v_donation.amount::numeric THEN
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
