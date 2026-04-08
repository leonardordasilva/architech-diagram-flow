
-- Add share_token_expires_at column to diagrams
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz;

COMMENT ON COLUMN public.diagrams.share_token_expires_at IS
  'When set, the share_token expires at this timestamp. NULL means no expiration (backward-compat).';

-- Update get_diagram_by_share_token to filter expired tokens
CREATE OR REPLACE FUNCTION public.get_diagram_by_share_token(token text)
 RETURNS SETOF diagrams
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT * FROM diagrams
  WHERE share_token = token
    AND is_shared = true
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now())
  LIMIT 1;
$$;
