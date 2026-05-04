-- 1) get_user_plan_limits: admins sempre recebem limites do plano 'team'
CREATE OR REPLACE FUNCTION public.get_user_plan_limits(p_user_id uuid)
 RETURNS TABLE(plan text, max_diagrams integer, max_nodes_per_diagram integer, max_collaborators_per_diagram integer, allowed_export_formats text[], watermark_enabled boolean, realtime_collab_enabled boolean, email_sharing_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pl.plan, pl.max_diagrams, pl.max_nodes_per_diagram, pl.max_collaborators_per_diagram,
    pl.allowed_export_formats, pl.watermark_enabled, pl.realtime_collab_enabled, pl.email_sharing_enabled
  FROM public.profiles pr
  JOIN public.plan_limits pl
    ON pl.plan = CASE WHEN pr.is_admin THEN 'team' ELSE pr.plan END
  WHERE pr.id = p_user_id;
$function$;

-- 2) handle_new_user: admin já entra como 'team'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_email TEXT;
  v_is_admin BOOLEAN := false;
  v_plan TEXT := 'free';
BEGIN
  SELECT decrypted_secret INTO v_admin_email
    FROM vault.decrypted_secrets
    WHERE name = 'ADMIN_EMAIL'
    LIMIT 1;

  IF v_admin_email IS NOT NULL AND NEW.email = v_admin_email THEN
    v_is_admin := true;
    v_plan := 'team';
  END IF;

  INSERT INTO public.profiles (id, email, is_admin, plan)
    VALUES (NEW.id, NEW.email, v_is_admin, v_plan)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          is_admin = GREATEST(profiles.is_admin, v_is_admin),
          plan = CASE WHEN GREATEST(profiles.is_admin, v_is_admin) THEN 'team' ELSE profiles.plan END;

  RETURN NEW;
END;
$function$;

-- 3) Backfill: garante que admins existentes estão como 'team' agora
UPDATE public.profiles SET plan = 'team' WHERE is_admin = true AND plan <> 'team';
