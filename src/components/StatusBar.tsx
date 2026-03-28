import React from 'react';
import { useViewport } from '@xyflow/react';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';
import type { SaveStatus } from '@/hooks/useAutoSave';
import { useTranslation } from 'react-i18next';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface StatusBarProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  saveStatus?: SaveStatus;
}

function StatusBar({ nodes, edges, saveStatus }: StatusBarProps) {
  const { zoom } = useViewport();
  const { t } = useTranslation();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);

  return (
    <div className="flex items-center justify-center gap-4 border-t border-border bg-card/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
      <span>{nodes.length} {t('status.nodes')}</span>
      <span className="text-border">•</span>
      <span>{edges.length} {t('status.connections')}</span>
      <span className="text-border">•</span>
      <span>{Math.round(zoom * 100)}%</span>
      {saveStatus === 'saved' && (
        <span className="text-green-500">• {t('status.saved')}</span>
      )}
      {saveStatus === 'saving' && (
        <span className="text-muted-foreground opacity-70">• {t('status.saving')}</span>
      )}
      {currentWorkspace && (
        <span className="text-border">•</span>
      )}
      {currentWorkspace && (
        <span className="capitalize text-blue-400/80">
          {t('workspace.roleBadge', { role: currentWorkspace.role })}
        </span>
      )}
    </div>
  );
}

export default React.memo(StatusBar);
