
-- Add revision_number column for realtime deduplication
ALTER TABLE public.diagrams ADD COLUMN IF NOT EXISTS revision_number BIGINT NOT NULL DEFAULT 0;

-- Trigger to auto-increment revision_number on each update
CREATE OR REPLACE FUNCTION public.increment_revision_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.revision_number = OLD.revision_number + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER diagrams_revision_trigger
BEFORE UPDATE ON public.diagrams
FOR EACH ROW EXECUTE FUNCTION public.increment_revision_number();
