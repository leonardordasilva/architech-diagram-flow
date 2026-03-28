
-- 1a. Índice composto para rate limiting na ai_requests
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created
ON public.ai_requests (user_id, created_at DESC);

-- 1b. Colunas de metadados não criptografados em diagrams
ALTER TABLE public.diagrams
  ADD COLUMN IF NOT EXISTS node_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edge_count integer NOT NULL DEFAULT 0;
