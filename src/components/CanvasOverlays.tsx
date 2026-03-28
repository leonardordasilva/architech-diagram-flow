import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DiagramContextMenu from '@/components/DiagramContextMenu';
import NodePropertiesPanel from '@/components/NodePropertiesPanel';
import type { DiagramNode } from '@/types/diagram';

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeLabel: string;
}

interface SpawnSource {
  id: string;
  label: string;
  nodeType: string;
}

interface CanvasOverlaysProps {
  nodes: DiagramNode[];
  interactionMode: 'pan' | 'select';
  onInteractionModeChange: (mode: 'pan' | 'select') => void;
  onSpawn: (source: SpawnSource) => void;
}

export interface CanvasOverlaysHandle {
  setContextMenu: (menu: ContextMenuState | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  clearContextMenu: () => void;
  clearSelectedNode: () => void;
}

export const CanvasOverlays = forwardRef<CanvasOverlaysHandle, CanvasOverlaysProps>(
  ({ nodes, interactionMode, onInteractionModeChange, onSpawn }, ref) => {
    const { t } = useTranslation();
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      setContextMenu,
      setSelectedNodeId,
      clearContextMenu: () => setContextMenu(null),
      clearSelectedNode: () => setSelectedNodeId(null),
    }));

    // Clear selected node if the node was removed from the canvas
    useEffect(() => {
      if (selectedNodeId && !nodes.find((n) => n.id === selectedNodeId)) {
        setSelectedNodeId(null);
      }
    }, [nodes, selectedNodeId]);

    // UX-03: Close context menu on scroll or window blur
    useEffect(() => {
      const close = () => setContextMenu(null);
      window.addEventListener('blur', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('blur', close);
        window.removeEventListener('scroll', close, true);
      };
    }, []);

    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Pan / Select mode toggle */}
        <div className="export-exclude pointer-events-auto absolute left-3 top-3 flex gap-1 rounded-lg border bg-card p-1 shadow-md">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={interactionMode === 'pan' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onInteractionModeChange('pan')}
                aria-label={t('overlays.moveCanvas')}
              >
                <Hand className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('overlays.moveCanvasDrag')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={interactionMode === 'select' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onInteractionModeChange('select')}
                aria-label={t('overlays.selectObjects')}
              >
                <MousePointer2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">{t('overlays.selectObjectsDrag')}</TooltipContent>
          </Tooltip>
        </div>

        {contextMenu && (
          <div className="pointer-events-auto">
            <DiagramContextMenu
              contextMenu={contextMenu}
              nodes={nodes}
              onSpawn={onSpawn}
              onClose={() => setContextMenu(null)}
            />
          </div>
        )}

        {selectedNodeId && (
          <div className="pointer-events-auto">
            <NodePropertiesPanel nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
          </div>
        )}
      </div>
    );
  },
);
CanvasOverlays.displayName = 'CanvasOverlays';
