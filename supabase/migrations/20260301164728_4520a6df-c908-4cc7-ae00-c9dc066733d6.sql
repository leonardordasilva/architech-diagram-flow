-- A01: Index for ai_requests rate-limit queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created ON public.ai_requests (user_id, created_at);

-- A01: Retention comment (5 minutes)
COMMENT ON TABLE public.ai_requests IS 'Rate-limit tracking. Rows older than 5 minutes are purged by edge functions.';