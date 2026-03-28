-- Security definer functions to avoid infinite recursion in RLS policies

CREATE OR REPLACE FUNCTION public.get_diagram_owner(diagram_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT owner_id FROM diagrams WHERE id = diagram_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_diagram_title(diagram_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT title FROM diagrams WHERE id = diagram_id LIMIT 1;
$$;

-- Drop and recreate the update policy without self-referencing subqueries
DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams
  FOR UPDATE
  USING (
    (owner_id = auth.uid())
    OR
    (EXISTS (
      SELECT 1 FROM diagram_shares
      WHERE diagram_shares.diagram_id = diagrams.id
        AND diagram_shares.shared_with_id = auth.uid()
    ))
  )
  WITH CHECK (
    (owner_id = auth.uid())
    OR
    (
      (EXISTS (
        SELECT 1 FROM diagram_shares
        WHERE diagram_shares.diagram_id = diagrams.id
          AND diagram_shares.shared_with_id = auth.uid()
      ))
      AND owner_id = public.get_diagram_owner(diagrams.id)
      AND title = public.get_diagram_title(diagrams.id)
    )
  );