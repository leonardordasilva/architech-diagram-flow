-- ITEM 4: Fix permissive RLS SELECT policy on diagrams
-- Remove OR share_token IS NOT NULL which allows any authenticated user to read any shared diagram
DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares ds
        WHERE ds.diagram_id = diagrams.id
          AND ds.shared_with_id = auth.uid()
      )
      OR (workspace_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = diagrams.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.accepted_at IS NOT NULL
      ))
    )
  );

-- ITEM 8: Add content_hash column for integrity verification
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS content_hash text;

-- ITEM 12: Partial index for content_hash lookups
CREATE INDEX IF NOT EXISTS idx_diagrams_content_hash
  ON public.diagrams (id, content_hash)
  WHERE content_hash IS NOT NULL;