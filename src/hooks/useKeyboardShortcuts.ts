import { useCallback } from 'react';
import { useDiagramStore } from '@/store/diagramStore';

interface UseKeyboardShortcutsOptions {
  onSave: () => void;
  onOpenShortcuts: () => void;
  onClearSelectedNode: () => void;
  onClearContextMenu: () => void;
}

export function useKeyboardShortcuts({
  onSave,
  onOpenShortcuts,
  onClearSelectedNode,
  onClearContextMenu,
}: UseKeyboardShortcutsOptions) {
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const undo = useCallback(() => useDiagramStore.temporal.getState().undo(), []);
  const redo = useCallback(() => useDiagramStore.temporal.getState().redo(), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete') { deleteSelected(); onClearSelectedNode(); }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); onSave(); }
      if (e.key === '?') onOpenShortcuts();
      if (e.key === 'Escape') { onClearSelectedNode(); onClearContextMenu(); }
    },
    [deleteSelected, undo, redo, onSave, onOpenShortcuts, onClearSelectedNode, onClearContextMenu],
  );

  return { handleKeyDown, undo, redo };
}
