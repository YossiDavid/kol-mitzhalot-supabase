-- Function to update phone_confirmed_at for external OTP verification
-- This function allows updating phone_confirmed_at when using external OTP providers (like Micropay)

CREATE OR REPLACE FUNCTION update_phone_confirmed(
  user_id uuid,
  confirmed_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth
AS $$
BEGIN
  UPDATE auth.users
  SET phone_confirmed_at = confirmed_at
  WHERE id = user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_phone_confirmed(uuid, timestamp with time zone) TO authenticated;

