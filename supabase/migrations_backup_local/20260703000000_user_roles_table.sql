-- ============================================================
-- User roles table — replaces user_metadata.role for RLS
-- Roles are server-controlled (only service role can write).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'user'
               CHECK (role IN ('admin', 'shadchan', 'user')),
  granted_at timestamptz DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Every user can read their own role
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all roles (uses SECURITY DEFINER function → no recursion)
CREATE POLICY "user_roles_select_admin"
  ON public.user_roles FOR SELECT
  USING (public.is_admin());

-- Only service-role key can INSERT / UPDATE / DELETE (bypasses RLS automatically)

-- ── Replace role-check functions to use the new table ──────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.get_my_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shadchan()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.get_my_role() IN ('admin', 'shadchan'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_shadchan_or_admin()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.get_my_role() IN ('admin', 'shadchan'), false);
$$;

-- is_approved_shadchan still checks shadchanim_info (application flow unchanged)
CREATE OR REPLACE FUNCTION public.is_approved_shadchan(uid uuid)
  RETURNS boolean LANGUAGE sql SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shadchanim_info
    WHERE user_id = uid AND application_status = 'approved'
  );
$$;

-- ── Migrate existing roles from user_metadata ──────────────────────────────
-- Copies roles already set via admin SDK (user_metadata.role) into the table.
INSERT INTO public.user_roles (user_id, role)
SELECT
  id,
  CASE (raw_user_meta_data->>'role')
    WHEN 'admin'   THEN 'admin'
    WHEN 'shadchan' THEN 'shadchan'
    ELSE 'user'
  END
FROM auth.users
WHERE raw_user_meta_data IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
