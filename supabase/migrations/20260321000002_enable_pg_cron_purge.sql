-- A1: Habilitar pg_cron e agendar purge semanal de diagramas soft-deleted
--
-- PRÉ-REQUISITO: A extensão pg_cron deve estar habilitada no projeto Supabase.
-- No dashboard: Database → Extensions → procurar "pg_cron" → Enable.
-- Se já estiver habilitada, o CREATE EXTENSION abaixo é um no-op.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar execução semanal: domingos às 03:00 UTC
-- Remove diagramas com deleted_at > 30 dias e seus diagram_shares associados
SELECT cron.schedule(
  'purge-deleted-diagrams',           -- nome único do job
  '0 3 * * 0',                        -- cron expression: domingo 03:00 UTC

  $$SELECT public.purge_old_soft_deleted_diagrams()$$
);

-- Comentário para documentação
COMMENT ON EXTENSION pg_cron IS
  'Agendador de jobs. Job ativo: purge-deleted-diagrams (dom 03:00 UTC). '
  'Verificar jobs: SELECT * FROM cron.job; '
  'Verificar execuções: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;';
