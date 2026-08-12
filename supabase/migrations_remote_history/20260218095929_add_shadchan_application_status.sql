-- הוספת עמודות סטטוס בקשה לטבלת shadchanim_info
ALTER TABLE public.shadchanim_info
ADD COLUMN IF NOT EXISTS application_status TEXT CHECK (application_status IN ('pending', 'approved', 'rejected')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT DEFAULT NULL;

-- הערה: application_status יהיה NULL עבור שדכנים קיימים (שאושרו בעבר)
-- application_status = 'pending' עבור בקשות חדשות
-- application_status = 'approved' לאחר אישור אדמין
-- application_status = 'rejected' אם נדחה

COMMENT ON COLUMN public.shadchanim_info.application_status IS 'סטטוס הבקשה: pending (ממתין), approved (אושר), rejected (נדחה), או NULL (שדכן קיים)';
COMMENT ON COLUMN public.shadchanim_info.submitted_at IS 'תאריך הגשת הבקשה';
COMMENT ON COLUMN public.shadchanim_info.approved_at IS 'תאריך אישור הבקשה';
COMMENT ON COLUMN public.shadchanim_info.rejected_at IS 'תאריך דחיית הבקשה';
COMMENT ON COLUMN public.shadchanim_info.rejected_reason IS 'סיבת הדחייה (אם נדחה)';;
