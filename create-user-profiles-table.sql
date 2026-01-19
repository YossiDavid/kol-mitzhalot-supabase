-- Create user_profiles table to store user metadata that can be queried with RLS
-- This table will be automatically synced with auth.users via triggers

-- 1. Create the user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policy - users can read profiles of users they chat with
CREATE POLICY "Users can read profiles of users they chat with"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- Allow if user is viewing their own profile
  auth.uid() = id
  OR
  -- Allow if users are in the same chat room
  EXISTS (
    SELECT 1
    FROM public.chat_room_participants crp1
    JOIN public.chat_room_participants crp2
      ON crp1.room_id = crp2.room_id
    WHERE crp1.user_id = auth.uid()
      AND crp2.user_id = user_profiles.id
      AND crp1.deleted_before IS NULL
      AND crp2.deleted_before IS NULL
  )
);

-- 4. Create function to sync user metadata to profiles
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name, email, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    NEW.email,
    NOW()
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- 5. Create trigger to sync on user creation/update
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_profile();

-- 6. Sync existing users
INSERT INTO public.user_profiles (id, first_name, last_name, email)
SELECT 
  id,
  raw_user_meta_data->>'firstName',
  raw_user_meta_data->>'lastName',
  email
FROM auth.users
ON CONFLICT (id) 
DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  updated_at = NOW();

-- 7. Create RPC function to get user profile (simpler alternative)
CREATE OR REPLACE FUNCTION get_user_metadata(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'firstName', first_name,
    'lastName', last_name,
    'email', email
  )
  INTO profile_data
  FROM public.user_profiles
  WHERE id = target_user_id;

  RETURN profile_data;
END;
$$;

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION get_user_metadata(UUID) TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;

-- 9. Add comments
COMMENT ON TABLE public.user_profiles IS 'User profiles synced from auth.users metadata';
COMMENT ON FUNCTION get_user_metadata(UUID) IS 'Returns user metadata (firstName, lastName, email) for a given user ID. Requires authentication and RLS policies apply.';

