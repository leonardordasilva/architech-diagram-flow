import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { useDiagramStore } from '@/store/diagramStore';
import { loadDiagramById } from '@/services/diagramService';

export function useDiagramRefresh() {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const lastLoadedUpdatedAtRef = useRef<string | null>(null);

  const diagramId = useDiagramStore((s) => s.currentDiagramId);
  const diagramName = useDiagramStore((s) => s.diagramName);
  const setDiagramName = useDiagramStore((s) => s.setDiagramName);
  const loadDiagram = useDiagramStore((s) => s.loadDiagram);

  const handleRefreshDiagram = useCallback(async () => {
    if (!diagramId) { toast({ title: t('canvas.saveFirst') }); return; }
    setRefreshing(true);
    try {
      const record = await loadDiagramById(diagramId);
      if (!record) { toast({ title: t('canvas.notFound'), variant: 'destructive' }); return; }
      if (record.integrityWarning) {
        toast({ title: t('integrity.warning'), description: t('integrity.hashMismatch'), variant: 'destructive', duration: 10000 });
      }
      if (record.updated_at === lastLoadedUpdatedAtRef.current) {
        toast({ title: t('canvas.alreadyUpdated') });
      } else {
        const temporal = useDiagramStore.temporal.getState();
        temporal.pause();
        loadDiagram(record.nodes, record.edges);
        if (record.title && record.title !== diagramName) setDiagramName(record.title);
        temporal.resume();
        lastLoadedUpdatedAtRef.current = record.updated_at;
        toast({ title: t('canvas.updateSuccess') });
      }
    } catch { toast({ title: t('canvas.updateError'), variant: 'destructive' }); }
    finally { setRefreshing(false); }
  }, [diagramId, loadDiagram, diagramName, setDiagramName, t]);

  return { refreshing, handleRefreshDiagram, lastLoadedUpdatedAtRef };
}
