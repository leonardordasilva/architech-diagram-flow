-- Fix: trigger enforce_diagram_limit referenced NEW.workspace_id before the column existed.
-- Depends on 20260322000001_add_workspaces.sql (adds workspace_id + workspaces table).

-- 1. Ensure workspace_id column exists (idempotent — no-op if already present)
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 2. Recreate the trigger function
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
  -- Workspace diagrams skip per-user limit
  IF NEW.workspace_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO v_plan FROM public.profiles WHERE id = NEW.owner_id;

  SELECT max_diagrams INTO v_max_diagrams
  FROM public.plan_limits
  WHERE plan = COALESCE(v_plan, 'free');

  IF v_max_diagrams IS NULL THEN
    RETURN NEW;
  END IF;

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

-- 3. Recreate trigger
DROP TRIGGER IF EXISTS enforce_diagram_limit ON public.diagrams;

CREATE TRIGGER enforce_diagram_limit
  BEFORE INSERT ON public.diagrams
  FOR EACH ROW
  EXECUTE FUNCTION public.check_diagram_limit_before_insert();
