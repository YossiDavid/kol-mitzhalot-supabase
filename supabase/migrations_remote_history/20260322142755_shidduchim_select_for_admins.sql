CREATE POLICY "Admins can view all shidduchim"
ON public.shidduchim
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);;
