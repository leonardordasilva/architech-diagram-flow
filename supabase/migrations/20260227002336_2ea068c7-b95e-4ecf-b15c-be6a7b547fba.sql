
-- Épico 1: Drop existing diagrams policies and create new secure ones
DROP POLICY IF EXISTS "Authenticated users can insert" ON diagrams;
DROP POLICY IF EXISTS "Owner full access" ON diagrams;
DROP POLICY IF EXISTS "Shared users can read diagrams" ON diagrams;
DROP POLICY IF EXISTS "Shared users can update diagrams" ON diagrams;

ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;

-- SELECT: owner, collaborator, or public shared
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
  OR is_shared = true
);

-- INSERT: only owner can insert their own
CREATE POLICY "diagrams_insert_policy"
ON diagrams FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- UPDATE: owner can update anything; collaborator can update but not change owner_id or title
CREATE POLICY "diagrams_update_policy"
ON diagrams FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM diagram_shares
    WHERE diagram_shares.diagram_id = diagrams.id
    AND diagram_shares.shared_with_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR (
    EXISTS (
      SELECT 1 FROM diagram_shares
      WHERE diagram_shares.diagram_id = diagrams.id
      AND diagram_shares.shared_with_id = auth.uid()
    )
    AND owner_id = (SELECT d2.owner_id FROM diagrams d2 WHERE d2.id = diagrams.id)
    AND title = (SELECT d2.title FROM diagrams d2 WHERE d2.id = diagrams.id)
  )
);

-- DELETE: only owner
CREATE POLICY "diagrams_delete_policy"
ON diagrams FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Épico 7: Drop existing diagram_shares policies and create new secure ones
DROP POLICY IF EXISTS "Owner manages shares" ON diagram_shares;
DROP POLICY IF EXISTS "Shared user can see own shares" ON diagram_shares;

ALTER TABLE diagram_shares ENABLE ROW LEVEL SECURITY;

-- SELECT: owner or shared_with user
CREATE POLICY "diagram_shares_select_policy"
ON diagram_shares FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR shared_with_id = auth.uid()
);

-- INSERT: only diagram owner can create shares
CREATE POLICY "diagram_shares_insert_policy"
ON diagram_shares FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM diagrams
    WHERE diagrams.id = diagram_id
    AND diagrams.owner_id = auth.uid()
  )
);

-- DELETE: owner can revoke, shared_with can leave
CREATE POLICY "diagram_shares_delete_policy"
ON diagram_shares FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid()
  OR shared_with_id = auth.uid()
);
