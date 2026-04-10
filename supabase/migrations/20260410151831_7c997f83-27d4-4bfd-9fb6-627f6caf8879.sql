CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_email TEXT;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Check if this user's email matches the configured admin email
  SELECT decrypted_secret INTO v_admin_email
    FROM vault.decrypted_secrets
    WHERE name = 'ADMIN_EMAIL'
    LIMIT 1;

  IF v_admin_email IS NOT NULL AND NEW.email = v_admin_email THEN
    v_is_admin := true;
  END IF;

  INSERT INTO public.profiles (id, email, is_admin)
    VALUES (NEW.id, NEW.email, v_is_admin)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_admin = GREATEST(profiles.is_admin, v_is_admin);

  RETURN NEW;
END;
$function$;