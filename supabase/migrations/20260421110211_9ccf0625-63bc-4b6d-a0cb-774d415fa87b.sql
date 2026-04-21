-- Fix privilege escalation: ensure non-owners cannot change owner_id via UPDATE.
-- The previous WITH CHECK allowed shared editors to set owner_id to their own uid
-- as long as title remained unchanged. We now strictly require owner_id to remain
-- equal to the original owner for any update performed by non-owners, and require
-- owner_id = auth.uid() for owners (preventing transfer to arbitrary users).

DROP POLICY IF EXISTS diagrams_update_policy ON public.diagrams;

CREATE POLICY diagrams_update_policy
  ON public.diagrams
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = diagrams.id AND ds.shared_with_id = auth.uid()
      )
      OR (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = diagrams.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = ANY (ARRAY['owner','editor'])
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  )
  WITH CHECK (
    -- owner_id MUST remain equal to the original owner — nobody can transfer ownership via UPDATE.
    owner_id = public.get_diagram_owner(id)
    AND (
      -- Owner can update freely (title, nodes, edges, etc.)
      owner_id = auth.uid()
      OR
      -- Shared editors can update content but title must remain unchanged
      (
        EXISTS (
          SELECT 1 FROM public.diagram_shares ds
          WHERE ds.diagram_id = diagrams.id AND ds.shared_with_id = auth.uid()
        )
        AND title = public.get_diagram_title(id)
      )
      OR
      -- Workspace editors/owners can update content but title must remain unchanged
      (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = diagrams.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = ANY (ARRAY['owner','editor'])
            AND wm.accepted_at IS NOT NULL
        )
        AND title = public.get_diagram_title(id)
      )
    )
  );