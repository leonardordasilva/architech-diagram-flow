-- R7: Add missing index on diagrams.owner_id
-- All diagram list queries filter by owner_id; without this index
-- PostgreSQL performs a sequential scan on the diagrams table.

CREATE INDEX IF NOT EXISTS idx_diagrams_owner_id
ON public.diagrams (owner_id);
