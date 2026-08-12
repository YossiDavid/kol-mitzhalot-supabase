-- תיקון RLS policy לטבלת system_content
-- הבעיה: ה-policy לא עובדת נכון מה-client-side

-- מחיקת ה-policy הישן
DROP POLICY IF EXISTS "Only admins can manage system content" ON public.system_content;

-- יצירת פונקציה שתבדוק אם המשתמש הוא admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'admin'
  );
$$;

-- יצירת policy חדש שמשתמש בפונקציה
CREATE POLICY "Only admins can manage system content"
  ON public.system_content
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON FUNCTION public.is_admin() IS 'בודק אם המשתמש הנוכחי הוא admin';;
