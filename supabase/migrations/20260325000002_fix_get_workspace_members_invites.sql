-- Update get_workspace_members to also return pending token-based invites
-- (users who don't have an account yet are stored in workspace_invites, not workspace_members)
CREATE OR REPLACE FUNCTION public.get_workspace_members(p_workspace_id uuid)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  email       text,
  role        text,
  invited_at  timestamptz,
  accepted_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, user_id, email, role, invited_at, accepted_at
  FROM (
    -- Members who have a user account (accepted or pending)
    SELECT
      wm.id,
      wm.user_id,
      p.email,
      wm.role,
      wm.invited_at,
      wm.accepted_at
    FROM public.workspace_members wm
    JOIN public.profiles p ON p.id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id

    UNION ALL

    -- Token-based invites for users without an account yet
    SELECT
      wi.id,
      NULL::uuid AS user_id,
      wi.email,
      wi.role,
      wi.created_at AS invited_at,
      NULL::timestamptz AS accepted_at
    FROM public.workspace_invites wi
    WHERE wi.workspace_id = p_workspace_id
      AND wi.accepted_at IS NULL
      AND wi.expires_at > now()
  ) combined
  ORDER BY (role = 'owner') DESC, invited_at ASC;
$$;
