-- הערה להנהלה בבקשת הצטרפות כשדכן: "למה כדאי לאשר אותי".
--
-- application_note: עמודה חדשה, nullable (שורות קיימות נשארות ריקות; השדה
-- אופציונלי). נראית רק לבעל הבקשה ולמנהל (RLS של shadchanim_info:
-- own-or-admin). פונקציות הפרופיל הציבורי (shadchan_public_profiles /
-- list_approved_shadchanim / get_shadchan_public_profile) בוחרות עמודות
-- במפורש ואינן כוללות אותה - ולכן אינה נחשפת לאף משתמש אחר.
-- אידמפוטנטית. להחלה: psql -v ON_ERROR_STOP=1 -f <file>

ALTER TABLE public.shadchanim_info
  ADD COLUMN IF NOT EXISTS application_note text;

ALTER TABLE public.shadchanim_info
  DROP CONSTRAINT IF EXISTS shadchanim_info_application_note_length_check;
ALTER TABLE public.shadchanim_info
  ADD CONSTRAINT shadchanim_info_application_note_length_check
  CHECK (application_note IS NULL OR char_length(application_note) <= 1000);

COMMENT ON COLUMN public.shadchanim_info.application_note IS
  'למה כדאי לאשר את המבקש/ת - להנהלה בלבד. לא חלק מהפרופיל הציבורי.';

-- ── Rollback ──────────────────────────────────────────────────────
-- ALTER TABLE public.shadchanim_info
--   DROP CONSTRAINT IF EXISTS shadchanim_info_application_note_length_check;
-- ALTER TABLE public.shadchanim_info DROP COLUMN IF EXISTS application_note;
