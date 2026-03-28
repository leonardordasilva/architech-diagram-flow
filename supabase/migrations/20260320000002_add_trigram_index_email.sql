-- R6: GIN trigram index on profiles.email for fast ILIKE searches
-- Without this, searchUsersByEmail with ILIKE '%term%' does a sequential scan.

-- Enable pg_trgm extension if not already active
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for partial email search (ILIKE '%term%')
CREATE INDEX IF NOT EXISTS idx_profiles_email_trgm
  ON public.profiles
  USING GIN (email gin_trgm_ops);
