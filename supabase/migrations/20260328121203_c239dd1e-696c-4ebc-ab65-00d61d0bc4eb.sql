-- Fix search_path warnings on functions missing it
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.set_workspaces_updated_at() SET search_path = public;
ALTER FUNCTION public.purge_old_soft_deleted_diagrams() SET search_path = public;
ALTER FUNCTION public.get_user_workspace(uuid) SET search_path = public;
ALTER FUNCTION public.get_workspace_editor_count(uuid) SET search_path = public;
ALTER FUNCTION public.get_workspace_members(uuid) SET search_path = public;