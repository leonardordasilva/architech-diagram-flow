import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useDiagramStore } from '@/store/diagramStore';
import { useAuth } from '@/hooks/useAuth';
import { saveDiagram, saveSharedDiagram } from '@/services/diagramService';
import { clearAutoSave } from '@/hooks/useAutoSave';
import { supabase } from '@/integrations/supabase/client';
import { usePlanStore } from '@/store/planStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { SAVE_COOLDOWN_MS } from '@/constants/storageKeys';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/getErrorMessage';

interface UseSaveDiagramOptions {
  shareToken?: string;
  /**
   * Called when diagram count limit is reached — use to open UpgradeModal.
   * N3: Callers MUST wrap this in `useCallback` (or provide a stable reference) to prevent
   * unnecessary recreation of the `save` callback and avoid stale-closure issues.
   */
  onDiagramLimitReached?: () => void;
}

interface UseSaveDiagramReturn {
  save: () => Promise<void>;
  saving: boolean;
  /** Stable ref that always points to latest save — use in event handlers to avoid stale closures */
  saveRef: React.RefObject<() => void>;
}

export function useSaveDiagram({ shareToken, onDiagramLimitReached }: UseSaveDiagramOptions = {}): UseSaveDiagramReturn {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  // isSavingRef mirrors `saving` but is always current — prevents stale-closure double-save
  const isSavingRef = useRef(false);
  const lastSaveTimestampRef = useRef<number>(0);

  // PERF-05: Read store state at call time instead of subscribing — avoids unnecessary callback recreation
  const save = useCallback(async () => {
    if (!user) return;
    // NOTE: 'saving' is intentionally omitted from deps — it is read as an
    // entry guard (checked at call time), not used to derive output. Including
    // it would cause the callback to be recreated on every setSaving() call,
    // which triggers the saveRef sync effect on every save cycle. (PRD-0032 T1)
    if (isSavingRef.current) return;

    // R5: Throttle temporal — impede saves consecutivos dentro do cooldown
    const now = Date.now();
    if (now - lastSaveTimestampRef.current < SAVE_COOLDOWN_MS) {
      toast({ title: t('save.recentlySaved') });
      return;
    }

    // Snapshot current store state at the moment of save
    const { nodes, edges, diagramName, currentDiagramId: diagramId, isCollaborator } = useDiagramStore.getState();
    const setDiagramId = useDiagramStore.getState().setCurrentDiagramId;

    // saas0001: enforce diagram count limit for new diagrams
    if (!diagramId && !isCollaborator) {
      const { limits } = usePlanStore.getState();
      if (limits.maxDiagrams !== null) {
        const { data: countData, error: countError } = await supabase.rpc('get_user_diagram_count', { p_user_id: user.id });
        if (!countError && countData !== null && countData >= limits.maxDiagrams) {
          onDiagramLimitReached?.();
          return;
        }
      }
    }

    isSavingRef.current = true;
    setSaving(true);
    let savedRecord: { id: string } | null = null;
    const isNewDiagram = !diagramId;
    const isSharedContext = !!shareToken && !diagramId;

    try {
      lastSaveTimestampRef.current = Date.now();
      if (isCollaborator && diagramId) {
        await saveSharedDiagram(diagramId, nodes, edges);
      } else {
        const workspaceId = useWorkspaceStore.getState().currentWorkspace?.id ?? null;
        savedRecord = await saveDiagram(diagramName, nodes, edges, user.id, diagramId, workspaceId);
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (msg === 'DIAGRAM_LIMIT_EXCEEDED') {
        onDiagramLimitReached?.();
      } else {
        console.error('[useSaveDiagram] Save error:', err);
        toast({ title: t('save.error'), description: msg, variant: 'destructive' });
      }
      isSavingRef.current = false;
      setSaving(false);
      return;
    }

    // State updates only after confirmed success — prevents diagramId desync on partial failure
    if (savedRecord) {
      setDiagramId(savedRecord.id);
      if (isNewDiagram) {
        queryClient.invalidateQueries({ queryKey: ['diagrams', user.id] });
      }
    }

    clearAutoSave();
    useDiagramStore.getState().setIsDirty(false);

    if (isCollaborator && diagramId) {
      toast({ title: t('save.sharedSaved') });
    } else if (isSharedContext) {
      toast({
        title: t('save.savedAsCopy'),
        description: t('save.savedAsCopyDesc'),
        duration: 6000,
      });
    } else {
      toast({ title: t('save.savedToCloud') });
    }

    isSavingRef.current = false;
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shareToken, onDiagramLimitReached]);

  // PERF-05: Stable ref always pointing to latest save
  const saveRef = useRef<() => void>(() => {});
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  return { save, saving, saveRef };
}
