CREATE OR REPLACE FUNCTION public.sync_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  fn text;
  ln text;
BEGIN
  fn := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'firstName'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '')
  );
  ln := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'lastName'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), '')
  );

  INSERT INTO public.user_profiles (id, first_name, last_name, email, updated_at)
  VALUES (
    NEW.id,
    fn,
    ln,
    NEW.email,
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    first_name = COALESCE(fn, user_profiles.first_name),
    last_name = COALESCE(ln, user_profiles.last_name),
    email = COALESCE(NEW.email, user_profiles.email),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;
;
