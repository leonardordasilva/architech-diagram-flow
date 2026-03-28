-- Fix: soft-delete (PATCH deleted_at) returns 403 because the UPDATE policy
-- uses `deleted_at IS NULL` in USING, which PostgreSQL also applies as an
-- implicit WITH CHECK on the new row — after setting deleted_at the new row
-- fails the check. Fix: explicit WITH CHECK that only verifies ownership.

DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams FOR UPDATE
  USING (
    deleted_at IS NULL AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid()
      )
      OR (
        workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role IN ('owner', 'editor')
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.diagram_shares ds
      WHERE ds.diagram_id = id AND ds.shared_with_id = auth.uid()
    )
    OR (
      workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'editor')
          AND wm.accepted_at IS NOT NULL
      )
    )
  );
