-- R3: Função para purgar diagramas soft-deleted com mais de 30 dias
-- Pode ser chamada manualmente via Supabase SQL Editor ou agendada via pg_cron

CREATE OR REPLACE FUNCTION public.purge_old_soft_deleted_diagrams()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Remove shares associados aos diagramas que serão purgados
  DELETE FROM public.diagram_shares
  WHERE diagram_id IN (
    SELECT id FROM public.diagrams
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
  );

  -- Purga permanente dos diagramas soft-deleted há mais de 30 dias
  DELETE FROM public.diagrams
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.purge_old_soft_deleted_diagrams()
  IS 'Purga permanente de diagramas soft-deleted há mais de 30 dias. '
     'Chamada manual: SELECT public.purge_old_soft_deleted_diagrams(); '
     'Para agendamento automático, habilitar pg_cron no projeto Supabase e criar: '
     'SELECT cron.schedule(''purge-deleted-diagrams'', ''0 3 * * 0'', ''SELECT public.purge_old_soft_deleted_diagrams()'');';

-- Índice parcial para acelerar a query de purge (só indexa registros com deleted_at)
CREATE INDEX IF NOT EXISTS idx_diagrams_deleted_at
  ON public.diagrams (deleted_at)
  WHERE deleted_at IS NOT NULL;
