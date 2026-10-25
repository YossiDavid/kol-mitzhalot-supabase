-- "מי הפנה אותך לקול מצהלות?" בבקשת הצטרפות כשדכן.
-- כמו application_note: nullable, אופציונלי, נראה רק לבעל הבקשה ולמנהל
-- (RLS של shadchanim_info). פונקציות הפרופיל הציבורי בוחרות עמודות במפורש
-- ואינן כוללות אותה.

ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS referral_source text;

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_referral_source_length_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_referral_source_length_check
  CHECK (referral_source IS NULL OR char_length(referral_source) <= 200);

COMMENT ON COLUMN public.shadchanim_info.referral_source IS
  'מי הפנה את המבקש/ת לקול מצהלות - להנהלה בלבד.';

-- ── Rollback ──────────────────────────────────────────────────────
-- ALTER TABLE public.shadchanim_info DROP COLUMN IF EXISTS referral_source;
