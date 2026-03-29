-- ── migration: 26_fix_select_policy_share_token.sql ──────────────────────────
-- Remove 'OR share_token IS NOT NULL' da diagrams_select_policy.

DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams FOR SELECT
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
            AND wm.accepted_at IS NOT NULL
        )
      )
    )
  );