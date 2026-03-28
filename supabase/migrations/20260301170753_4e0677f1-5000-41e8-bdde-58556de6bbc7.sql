-- Migration: adjust index on ai_requests for rate-limit query performance
-- PRD-12 / R4-INF-01

DROP INDEX IF EXISTS idx_ai_requests_user_created;

CREATE INDEX idx_ai_requests_user_created
  ON ai_requests (user_id, created_at DESC);

COMMENT ON TABLE ai_requests IS
  'Registros de requisições de IA para rate limiting.
   Política de retenção: registros com mais de 5 minutos são
   purgados proativamente pela Edge Function generate-diagram.
   O índice idx_ai_requests_user_created é crítico para
   performance das queries de contagem por usuário.';