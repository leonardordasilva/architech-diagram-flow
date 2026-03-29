-- ── migration: 27_restrict_update_with_check.sql ─────────────────────────────
-- Restringe WITH CHECK no UPDATE: collaborators não podem alterar
-- owner_id, title, is_shared, ou share_token.

DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams FOR UPDATE
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
            AND wm.role IN ('owner', 'editor')
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  )
  WITH CHECK (
    (owner_id = auth.uid())
    OR
    (
      (
        EXISTS (
          SELECT 1 FROM public.diagram_shares ds
          WHERE ds.diagram_id = diagrams.id AND ds.shared_with_id = auth.uid()
        )
        OR (
          workspace_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = diagrams.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'editor')
              AND wm.accepted_at IS NOT NULL
          )
        )
      )
      AND owner_id = public.get_diagram_owner(id)
      AND title = public.get_diagram_title(id)
    )
  );