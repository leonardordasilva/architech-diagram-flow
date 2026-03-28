-- Fix: use a SECURITY DEFINER RPC for soft delete to bypass RLS UPDATE policy complexity.
-- The UPDATE policy WITH CHECK causes 403 even with explicit WITH CHECK clause.
-- This function validates ownership server-side and performs the soft delete directly.

CREATE OR REPLACE FUNCTION public.soft_delete_diagram(p_diagram_id uuid, p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate ownership before soft-deleting
  IF NOT EXISTS (
    SELECT 1 FROM public.diagrams
    WHERE id = p_diagram_id AND owner_id = p_owner_id
  ) THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.diagrams
  SET deleted_at = now()
  WHERE id = p_diagram_id AND owner_id = p_owner_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_diagram(uuid, uuid) TO authenticated;
