CREATE OR REPLACE FUNCTION public.is_shadchan()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'role')::text = 'shadchan'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_shadchan_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.is_admin() OR public.is_shadchan();
$function$;

GRANT EXECUTE ON FUNCTION public.is_shadchan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shadchan_or_admin() TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile or shadchanim see all" ON public.students;
CREATE POLICY "Users can view own profile or shadchanim see all"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id OR public.is_shadchan_or_admin());

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.education_history;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.education_history FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = education_history.student_id
        AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.employment_history;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.employment_history FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = employment_history.student_id
        AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.medical_records;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.medical_records FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = medical_records.student_id
        AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.partner_preferences;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.partner_preferences FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = partner_preferences.student_id
        AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public.previous_partners;
CREATE POLICY "Users read own students or shadchanim see all"
  ON public.previous_partners FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = previous_partners.student_id
        AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own students or shadchanim see all" ON public."references";
CREATE POLICY "Users read own students or shadchanim see all"
  ON public."references" FOR SELECT
  USING (
    public.is_shadchan_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.students
      WHERE students.id = "references".student_id
        AND students.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Shadchanim_info select own or admin" ON public.shadchanim_info;
CREATE POLICY "Shadchanim_info select own or admin"
  ON public.shadchanim_info FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Shadchanim_info insert own or admin" ON public.shadchanim_info;
CREATE POLICY "Shadchanim_info insert own or admin"
  ON public.shadchanim_info FOR INSERT
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Shadchanim_info update own or admin" ON public.shadchanim_info;
CREATE POLICY "Shadchanim_info update own or admin"
  ON public.shadchanim_info FOR UPDATE
  USING (public.is_admin() OR auth.uid() = user_id)
  WITH CHECK (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Shadchanim_info delete admin only" ON public.shadchanim_info;
CREATE POLICY "Shadchanim_info delete admin only"
  ON public.shadchanim_info FOR DELETE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all shidduchim" ON public.shidduchim;
CREATE POLICY "Admins can view all shidduchim"
  ON public.shidduchim FOR SELECT
  USING (public.is_admin());;
