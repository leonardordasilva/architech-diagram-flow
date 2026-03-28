-- Add unique constraint on workspace_invites(workspace_id, email)
-- required for upsert onConflict to work correctly
ALTER TABLE public.workspace_invites
  ADD CONSTRAINT workspace_invites_workspace_email_unique UNIQUE (workspace_id, email);
