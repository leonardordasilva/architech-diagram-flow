import { useTranslation } from 'react-i18next';
import Toolbar from '@/components/Toolbar';
import DiagramHeader from '@/components/DiagramHeader';
import WorkspaceContextSelector from '@/components/WorkspaceContextSelector';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Collaborator } from '@/hooks/useRealtimeCollab';

interface DiagramToolbarStripProps {
  readOnly: boolean;
  // Toolbar props
  onAddNode: (type: string) => void;
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
  // Header props
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
  onOpenShortcuts: () => void;
  plan: 'free' | 'pro' | 'team';
}

export default function DiagramToolbarStrip(props: DiagramToolbarStripProps) {
  const { t } = useTranslation();

  if (props.readOnly) return null;

  return (
    <>
      <Toolbar
        onAddNode={props.onAddNode}
        onDelete={props.onDelete}
        onClearCanvas={props.onClearCanvas}
        onUndo={props.onUndo}
        onRedo={props.onRedo}
        onAutoLayout={props.onAutoLayout}
        onExportPNG={props.onExportPNG}
        onExportSVG={props.onExportSVG}
        onExportMermaid={props.onExportMermaid}
        onExportJSON={props.onExportJSON}
        onImportJSON={props.onImportJSON}
        diagramName={props.diagramName}
        onDiagramNameChange={props.onDiagramNameChange}
        darkMode={props.darkMode}
        onToggleDarkMode={props.onToggleDarkMode}
        allowedExportFormats={props.allowedExportFormats}
        onUpgradeRequest={props.onUpgradeRequest}
        actionsDisabled={props.actionsDisabled}
      />
      <WorkspaceContextSelector />
      <DiagramHeader
        shareToken={props.shareToken}
        diagramId={props.diagramId}
        isCollaborator={props.isCollaborator}
        user={props.user}
        collaborators={props.collaborators}
        saving={props.saving}
        refreshing={props.refreshing}
        onSave={props.onSave}
        onRefresh={props.onRefresh}
        onSignOut={props.onSignOut}
        onOpenBilling={props.onOpenBilling}
        onOpenAccount={props.onOpenAccount}
        onOpenMyDiagrams={props.onOpenMyDiagrams}
        plan={props.plan}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={props.onOpenShortcuts} aria-label={t('canvas.keyboardShortcuts')}>
            <Keyboard className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{t('canvas.keyboardShortcutsBtn')}</TooltipContent>
      </Tooltip>
    </>
  );
}
