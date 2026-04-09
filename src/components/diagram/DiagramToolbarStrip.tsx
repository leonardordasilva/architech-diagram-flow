import { useTranslation } from 'react-i18next';
import Toolbar from '@/components/Toolbar';
import DiagramHeader from '@/components/DiagramHeader';
import WorkspaceContextSelector from '@/components/WorkspaceContextSelector';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Collaborator } from '@/hooks/useRealtimeCollab';
import type { NodeType } from '@/types/diagram';

export interface ToolbarSectionProps {
  onAddNode: (type: NodeType, subType?: string) => void;
  onDelete: () => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: (engine: string, direction: string) => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportMermaid: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  diagramName: string;
  onDiagramNameChange: (name: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  allowedExportFormats: string[];
  onUpgradeRequest: (feature: string) => void;
  actionsDisabled: boolean;
}

export interface HeaderSectionProps {
  shareToken?: string;
  diagramId: string | null;
  isCollaborator: boolean;
  user: { id: string; email?: string } | null;
  collaborators: Collaborator[];
  saving: boolean;
  refreshing: boolean;
  onSave: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
  onOpenBilling: () => void;
  onOpenAccount: () => void;
  onOpenMyDiagrams: () => void;
  plan: 'free' | 'pro' | 'team';
}

interface DiagramToolbarStripProps {
  readOnly: boolean;
  toolbar: ToolbarSectionProps;
  header: HeaderSectionProps;
  onOpenShortcuts: () => void;
}

export default function DiagramToolbarStrip({ readOnly, toolbar, header, onOpenShortcuts }: DiagramToolbarStripProps) {
  const { t } = useTranslation();

  if (readOnly) return null;

  return (
    <>
      <Toolbar {...toolbar} />
      <WorkspaceContextSelector />
      <DiagramHeader {...header} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenShortcuts} aria-label={t('canvas.keyboardShortcuts')}>
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t('canvas.keyboardShortcutsBtn')}</TooltipContent>
      </Tooltip>
    </>
  );
}
