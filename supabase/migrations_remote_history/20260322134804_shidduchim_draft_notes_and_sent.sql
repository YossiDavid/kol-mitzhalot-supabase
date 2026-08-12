-- Draft status for offers; notes and send metadata
DO $$ BEGIN
  ALTER TYPE public.shidduch_status_enum ADD VALUE 'draft';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.shidduchim
  ADD COLUMN IF NOT EXISTS note_for_groom text,
  ADD COLUMN IF NOT EXISTS note_for_bride text,
  ADD COLUMN IF NOT EXISTS recipient_scope text CHECK (recipient_scope IS NULL OR recipient_scope IN ('both', 'groom_only', 'bride_only')),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

COMMENT ON COLUMN public.shidduchim.note_for_groom IS 'הערת השדכן שתישלח/תוצג לצד המיועד';
COMMENT ON COLUMN public.shidduchim.note_for_bride IS 'הערת השדכן שתישלח/תוצג לצד המיועדת';
COMMENT ON COLUMN public.shidduchim.recipient_scope IS 'למי נשלחה ההצעה: both | groom_only | bride_only';
COMMENT ON COLUMN public.shidduchim.sent_at IS 'מתי נשלחה ההצעה במייל (NULL = טיוטה או לא נשלחו)';
;
