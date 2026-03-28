-- Fix: infinite recursion in workspace_members RLS policies.
-- Policies on workspace_members that query workspace_members itself cause recursion.
-- Solution: SECURITY DEFINER helper functions that bypass RLS.

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_owner_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid() AND role = 'owner';
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_owner_workspace_ids() TO authenticated;

-- Recreate workspace_members policies without self-referencing subqueries
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_owner_manage" ON public.workspace_members;

CREATE POLICY "workspace_members_select"
  ON public.workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "workspace_members_owner_manage"
  ON public.workspace_members FOR ALL
  USING (workspace_id IN (SELECT public.get_my_owner_workspace_ids()));

-- Also fix workspace_invites policy that queries workspace_members
DROP POLICY IF EXISTS "workspace_invites_owner_manage" ON public.workspace_invites;

CREATE POLICY "workspace_invites_owner_manage"
  ON public.workspace_invites FOR ALL
  USING (workspace_id IN (SELECT public.get_my_owner_workspace_ids()));
