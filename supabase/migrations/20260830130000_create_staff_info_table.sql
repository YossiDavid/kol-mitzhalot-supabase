-- טבלת staff_info: מקבילה ל-shadchanim_info עבור בקשות הצטרפות "איש צוות".
-- נדרשת ע"י מסך "הצטרפות כאיש צוות" (app/app/settings/staff) וע"י מסך הבקשות
-- לאישור מנהל (app/app/admin/staff/requests). ראה shadchanim_info במיגרציית
-- הבסיס (20260101000000_remote_baseline.sql) למבנה המקורי שממנו הועתק הדפוס.

CREATE TABLE IF NOT EXISTS public.staff_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution text,
  city text,
  "position" text,
  application_status text CHECK (application_status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff_info IS 'מידע ובקשות הצטרפות של אנשי צוות - מוסד לימודים, עיר ותפקיד';
COMMENT ON COLUMN public.staff_info.user_id IS 'מזהה המשתמש (חייב להיות איש צוות)';
COMMENT ON COLUMN public.staff_info.institution IS 'מוסד הלימודים אליו משתייך איש הצוות';
COMMENT ON COLUMN public.staff_info.city IS 'עיר';
COMMENT ON COLUMN public.staff_info."position" IS 'תפקיד איש הצוות במוסד';
COMMENT ON COLUMN public.staff_info.application_status IS 'סטטוס הבקשה: pending (ממתין), approved (אושר), rejected (נדחה), או NULL';
COMMENT ON COLUMN public.staff_info.submitted_at IS 'תאריך הגשת הבקשה';
COMMENT ON COLUMN public.staff_info.approved_at IS 'תאריך אישור הבקשה';
COMMENT ON COLUMN public.staff_info.rejected_at IS 'תאריך דחיית הבקשה';
COMMENT ON COLUMN public.staff_info.rejected_reason IS 'סיבת הדחייה (אם נדחה)';

CREATE INDEX IF NOT EXISTS idx_staff_info_user_id ON public.staff_info USING btree (user_id);

-- טריגר updated_at, מקביל ל-update_shadchanim_info_updated_at()
CREATE OR REPLACE FUNCTION public.update_staff_info_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_staff_info_updated_at ON public.staff_info;
CREATE TRIGGER trigger_update_staff_info_updated_at
  BEFORE UPDATE ON public.staff_info
  FOR EACH ROW EXECUTE FUNCTION public.update_staff_info_updated_at();

-- פונקציית עזר, מקבילה ל-is_approved_shadchan(uid)
CREATE OR REPLACE FUNCTION public.is_approved_staff(uid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_info WHERE user_id = uid AND application_status = 'approved');
$$;

GRANT ALL ON FUNCTION public.is_approved_staff(uuid) TO anon;
GRANT ALL ON FUNCTION public.is_approved_staff(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_approved_staff(uuid) TO service_role;

ALTER TABLE public.staff_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff_info select own or admin" ON public.staff_info;
CREATE POLICY "Staff_info select own or admin" ON public.staff_info
  FOR SELECT USING (public.is_admin() OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Staff_info insert own or admin" ON public.staff_info;
CREATE POLICY "Staff_info insert own or admin" ON public.staff_info
  FOR INSERT WITH CHECK (public.is_admin() OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Staff_info update own or admin" ON public.staff_info;
CREATE POLICY "Staff_info update own or admin" ON public.staff_info
  FOR UPDATE USING (public.is_admin() OR (auth.uid() = user_id))
  WITH CHECK (public.is_admin() OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "Staff_info delete admin only" ON public.staff_info;
CREATE POLICY "Staff_info delete admin only" ON public.staff_info
  FOR DELETE USING (public.is_admin());

GRANT ALL ON TABLE public.staff_info TO anon;
GRANT ALL ON TABLE public.staff_info TO authenticated;
GRANT ALL ON TABLE public.staff_info TO service_role;
