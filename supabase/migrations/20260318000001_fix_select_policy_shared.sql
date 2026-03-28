-- R10: Fix SELECT policy — remove OR is_shared = true
-- The is_shared column + share_token are used by the SECURITY DEFINER
-- function get_diagram_by_share_token which bypasses RLS entirely.
-- Having is_shared in the RLS policy allows ANY authenticated user
-- to read ANY public diagram, which is an over-permissive data leak.

DROP POLICY IF EXISTS "diagrams_select_policy" ON diagrams;

CREATE POLICY "diagrams_select_policy"
ON diagrams FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM diagram_shares
    WHERE diagram_shares.diagram_id = diagrams.id
    AND diagram_shares.shared_with_id = auth.uid()
  )
);
