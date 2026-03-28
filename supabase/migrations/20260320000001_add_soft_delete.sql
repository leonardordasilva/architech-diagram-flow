-- R9: Soft delete for diagrams
-- Replaces hard DELETE with a deleted_at timestamp update so that
-- accidental deletions can be recovered via the Supabase dashboard.

-- 1. Add the soft-delete column
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Update SELECT policy to exclude soft-deleted rows
--    (R10 policy is dropped and replaced here with deleted_at guard added)
DROP POLICY IF EXISTS "diagrams_select_policy" ON public.diagrams;

CREATE POLICY "diagrams_select_policy"
  ON public.diagrams
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares
        WHERE diagram_shares.diagram_id = diagrams.id
          AND diagram_shares.shared_with_id = auth.uid()
      )
    )
  );

-- 3. Update UPDATE policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "diagrams_update_policy" ON public.diagrams;

CREATE POLICY "diagrams_update_policy"
  ON public.diagrams
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.diagram_shares
        WHERE diagram_shares.diagram_id = diagrams.id
          AND diagram_shares.shared_with_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.diagram_shares
      WHERE diagram_shares.diagram_id = diagrams.id
        AND diagram_shares.shared_with_id = auth.uid()
    )
  );
