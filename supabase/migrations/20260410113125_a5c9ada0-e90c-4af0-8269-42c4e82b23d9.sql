
-- 1. Fix workspace_invites: remove public read-all, add scoped policies
DROP POLICY IF EXISTS "workspace_invites_public_read" ON public.workspace_invites;

CREATE POLICY "workspace_invites_invitee_read"
  ON public.workspace_invites FOR SELECT TO authenticated
  USING (
    email = (auth.jwt() ->> 'email')
    OR workspace_id IN (SELECT get_my_owner_workspace_ids())
  );

-- 2. Fix workspaces member SELECT (broken join bug)
DROP POLICY IF EXISTS "workspaces_members_select" ON public.workspaces;

CREATE POLICY "workspaces_members_select"
  ON public.workspaces FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.accepted_at IS NOT NULL
    )
  );

-- 3. Fix profiles: restrict SELECT to own row only
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 4. Create SECURITY DEFINER function so sharing UI can look up collaborator emails
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(p_ids uuid[])
RETURNS TABLE(id uuid, email text, avatar_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(p_ids);
$$;
