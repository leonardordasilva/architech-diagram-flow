import { useState, useEffect } from 'react';
import { getAutoSave, clearAutoSave, type AutoSaveData } from '@/hooks/useAutoSave';
import { useDiagramStore } from '@/store/diagramStore';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';
import { toast } from '@/hooks/use-toast';
import { X, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const RECOVERY_FLAG_KEY = 'microflow_show_recovery';

/** Call this to signal that a recovery banner should appear on next canvas load */
export function triggerRecoveryBanner() {
  sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
}

export default function RecoveryBanner() {
  const { t } = useTranslation();
  const [savedData, setSavedData] = useState<AutoSaveData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const nodes = useDiagramStore((s) => s.nodes);

  useEffect(() => {
    // Only show if explicitly triggered (e.g. after deleting a diagram)
    const flag = sessionStorage.getItem(RECOVERY_FLAG_KEY);
    if (flag && nodes.length === 0 && !dismissed) {
      getAutoSave().then((data) => {
        setSavedData(data);
      });
      sessionStorage.removeItem(RECOVERY_FLAG_KEY);
    }
  }, []); // Run once on mount

  if (!savedData || dismissed || nodes.length > 0) return null;

  const formattedDate = new Date(savedData.savedAt).toLocaleString(
    navigator.language.startsWith('pt') ? 'pt-BR' : 'en-US',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  );

  const handleRestore = () => {
    const nodesParsed = DbDiagramNodesSchema.safeParse(savedData.nodes);
    const edgesParsed = DbDiagramEdgesSchema.safeParse(savedData.edges);
    if (!nodesParsed.success || !edgesParsed.success) {
      toast({ title: t('recovery.corruptedData'), variant: 'destructive' });
      clearAutoSave();
      setDismissed(true);
      return;
    }
    const { loadDiagram, setDiagramName } = useDiagramStore.getState();
    loadDiagram(nodesParsed.data as DiagramNode[], edgesParsed.data as DiagramEdge[]);
    if (savedData.title) setDiagramName(savedData.title);
    setDismissed(true);
  };

  const handleDiscard = () => {
    clearAutoSave();
    setDismissed(true);
  };

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-900/80 px-4 py-2.5 shadow-lg backdrop-blur-sm">
        <FolderOpen className="h-4 w-4 text-amber-300 shrink-0" />
        <span className="text-sm text-amber-100">
          {t('recovery.title')}: "<strong>{savedData.title}</strong>" — {t('recovery.savedAt')} {formattedDate}
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-500/40 bg-amber-800/50 text-amber-100 hover:bg-amber-700/60"
            onClick={handleRestore}
          >
            {t('recovery.restore')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-amber-300 hover:bg-amber-800/50 hover:text-amber-100"
            onClick={handleDiscard}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {t('recovery.discard')}
          </Button>
        </div>
      </div>
    </div>
  );
}
