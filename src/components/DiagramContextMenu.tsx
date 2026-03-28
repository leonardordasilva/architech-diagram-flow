import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagramNode, DiagramNodeData } from '@/types/diagram';

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
}

interface DiagramContextMenuProps {
  contextMenu: ContextMenuState;
  nodes: DiagramNode[];
  onSpawn: (source: { id: string; label: string; nodeType: string }) => void;
  onClose: () => void;
}

function DiagramContextMenu({ contextMenu, nodes, onSpawn, onClose }: DiagramContextMenuProps) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed z-50 rounded-md border bg-popover p-1 shadow-md min-w-[180px]"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => {
          const nd = nodes.find((n) => n.id === contextMenu.nodeId);
          onSpawn({ id: contextMenu.nodeId, label: contextMenu.nodeLabel, nodeType: nd?.type || '' });
          onClose();
        }}
      >
        {t('contextMenu.createFrom')}
      </button>
    </div>
  );
}

export default React.memo(DiagramContextMenu);
