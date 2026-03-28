
-- Add is_shared column (default false so existing diagrams are private)
ALTER TABLE public.diagrams ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

-- Remove the default on share_token so new diagrams don't auto-generate tokens
ALTER TABLE public.diagrams ALTER COLUMN share_token DROP DEFAULT;

-- Drop the broken RLS policy
DROP POLICY IF EXISTS "Public read via share_token" ON public.diagrams;

-- Create a secure RPC to fetch diagrams by share token (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_diagram_by_share_token(token TEXT)
RETURNS SETOF public.diagrams
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM diagrams WHERE share_token = token AND is_shared = true LIMIT 1;
$$;
