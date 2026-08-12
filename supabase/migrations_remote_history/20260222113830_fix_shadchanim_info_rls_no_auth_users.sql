-- הסרת מדיניות שמפנות ל-auth.users (גורמות ל-permission denied למשתמשים רגילים)
DROP POLICY IF EXISTS "Admins can manage all shadchanim info" ON public.shadchanim_info;
DROP POLICY IF EXISTS "Admins can view all shadchanim info" ON public.shadchanim_info;

-- מדיניות אדמין חדשות שמשתמשות ב-JWT במקום auth.users
-- כך שהתפקיד authenticated לא צריך גישה לטבלת auth.users
CREATE POLICY "Admins can manage all shadchanim info"
ON public.shadchanim_info
FOR ALL
TO public
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

CREATE POLICY "Admins can view all shadchanim info"
ON public.shadchanim_info
FOR SELECT
TO public
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);;
