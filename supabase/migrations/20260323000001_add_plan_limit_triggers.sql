-- B6: Server-side trigger to enforce diagram count limit.
-- Provides a second layer beyond the client-side check in useSaveDiagram.ts,
-- protecting against race conditions and direct API access.

CREATE OR REPLACE FUNCTION public.check_diagram_limit_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan          TEXT;
  v_max_diagrams  INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Workspace diagrams are managed at the workspace level — skip per-user limit
  IF NEW.workspace_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the owner's current plan
  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.owner_id;

  -- Fetch the plan's diagram cap (NULL = unlimited)
  SELECT max_diagrams INTO v_max_diagrams
  FROM public.plan_limits
  WHERE plan = COALESCE(v_plan, 'free');

  -- NULL cap means unlimited — allow the insert
  IF v_max_diagrams IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count existing non-deleted diagrams owned by this user
  SELECT COUNT(*) INTO v_current_count
  FROM public.diagrams
  WHERE owner_id = NEW.owner_id
    AND deleted_at IS NULL
    AND workspace_id IS NULL;

  IF v_current_count >= v_max_diagrams THEN
    RAISE EXCEPTION 'DIAGRAM_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_diagram_limit
  BEFORE INSERT ON public.diagrams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_diagram_limit_before_insert();
