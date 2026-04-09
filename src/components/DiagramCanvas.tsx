import { useState, useCallback, useRef, useEffect } from 'react';
import UnsavedChangesDialog from '@/components/UnsavedChangesDialog';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  BackgroundVariant, SelectionMode, type Connection,
} from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useSnapGuides } from '@/hooks/useSnapGuides';
import SnapGuideLines from '@/components/SnapGuideLines';
import { toast } from '@/hooks/use-toast';
import { useDiagramStore } from '@/store/diagramStore';
import type { DiagramNodeData, DiagramNode, NodeType } from '@/types/diagram';
import { DiagramModals, type DiagramModalsHandle } from '@/components/DiagramModals';
import { CanvasOverlays, type CanvasOverlaysHandle } from '@/components/CanvasOverlays';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSaveDiagram } from '@/hooks/useSaveDiagram';
import { useRealtimeCollab } from '@/hooks/useRealtimeCollab';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useExportHandlers } from '@/hooks/useExportHandlers';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useWorkspace } from '@/hooks/useWorkspace';
import UpgradeModal from '@/components/UpgradeModal';
import BillingModal from '@/components/BillingModal';
import AccountModal from '@/components/AccountModal';
import MyDiagramsModal from '@/pages/MyDiagrams';
import StatusBar from '@/components/StatusBar';
import DiagramToolbarStrip from '@/components/diagram/DiagramToolbarStrip';
import DiagramStatusOverlays from '@/components/diagram/DiagramStatusOverlays';
import { nodeTypes, edgeTypes, MINIMAP_NODE_COLORS, defaultEdgeOptions } from '@/components/diagram/diagramFlowConfig';
import type { LayoutDirection } from '@/services/layoutService';
import { canConnect, connectionErrorMessage } from '@/utils/connectionRules';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import { useInteractionMode } from '@/hooks/useInteractionMode';
import { useDiagramRefresh } from '@/hooks/useDiagramRefresh';
import { useAddNodeToCanvas } from '@/hooks/useAddNodeToCanvas';

interface DiagramCanvasProps { shareToken?: string; readOnly?: boolean; }

function DiagramCanvasInner({ shareToken, readOnly = false }: DiagramCanvasProps) {
  const { t } = useTranslation();
  const { nodes, edges, diagramName, diagramId, isCollaborator } = useDiagramStore(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges, diagramName: s.diagramName, diagramId: s.currentDiagramId, isCollaborator: s.isCollaborator })),
  );
  const { setDiagramName, onNodesChange, onEdgesChange, onConnect: onConnectAction, onNodeDragHandler, addNodesFromSource, deleteSelected, autoLayout, autoLayoutELK, clearCanvas, loadDiagram } = useDiagramStore(
    useShallow((s) => ({ setDiagramName: s.setDiagramName, onNodesChange: s.onNodesChange, onEdgesChange: s.onEdgesChange, onConnect: s.onConnect, onNodeDragHandler: s.onNodeDragHandler, addNodesFromSource: s.addNodesFromSource, deleteSelected: s.deleteSelected, autoLayout: s.autoLayout, autoLayoutELK: s.autoLayoutELK, clearCanvas: s.clearCanvas, loadDiagram: s.loadDiagram })),
  );

  const { user, signOut } = useAuth();
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const handleSignOutRequest = useCallback(() => { if (useDiagramStore.getState().isDirty) { setSignOutDialogOpen(true); return; } signOut(); }, [signOut]);
  const handleSaveAndLeave = useCallback(async () => { setSignOutDialogOpen(false); await handleSaveToCloudRef.current?.(); signOut(); }, [signOut]);
  const handleLeaveWithout = useCallback(() => { setSignOutDialogOpen(false); signOut(); }, [signOut]);

  const planLimits = usePlanLimits();
  useWorkspace();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('');
  const [billingOpen, setBillingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [myDiagramsOpen, setMyDiagramsOpen] = useState(false);
  const openUpgradeModal = useCallback((f: string) => { setUpgradeFeatureName(f); setUpgradeModalOpen(true); }, []);

  const { data: diagramCount } = useQuery({
    queryKey: ['diagram-count', user?.id],
    queryFn: async () => { const { data } = await supabase.rpc('get_user_diagram_count', { p_user_id: user!.id }); return (data as number) ?? 0; },
    enabled: !!user && !diagramId && planLimits.maxDiagrams !== null, staleTime: 30_000,
  });
  const toolbarLocked = !!user && !diagramId && planLimits.maxDiagrams !== null && diagramCount !== undefined && diagramCount >= planLimits.maxDiagrams;

  const { save: handleSaveToCloud, saving, saveRef: handleSaveToCloudRef } = useSaveDiagram({ shareToken, onDiagramLimitReached: () => openUpgradeModal('Diagramas ilimitados') });
  const { darkMode, toggleDarkMode } = useThemeToggle();
  const { interactionMode, handleSetInteractionMode } = useInteractionMode();
  const { refreshing, handleRefreshDiagram, lastLoadedUpdatedAtRef } = useDiagramRefresh();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const modalsRef = useRef<DiagramModalsHandle>(null);
  const overlaysRef = useRef<CanvasOverlaysHandle>(null);

  const { handleAddNode } = useAddNodeToCanvas(reactFlowWrapper);
  const { guides, onNodeDrag, onNodeDragStop } = useSnapGuides(nodes);
  const { broadcastChanges, collaborators } = useRealtimeCollab(shareToken || null, planLimits.realtimeCollabEnabled, user);
  const { saveStatus } = useAutoSave();
  const { handleExportPNG, handleExportSVG, handleExportMermaid, handleExportJSON } = useExportHandlers(darkMode, planLimits.watermarkEnabled);

  const { handleKeyDown, undo, redo } = useKeyboardShortcuts({
    onSave: () => handleSaveToCloudRef.current?.(), onOpenShortcuts: () => modalsRef.current?.openShortcuts(),
    onClearSelectedNode: () => overlaysRef.current?.clearSelectedNode(), onClearContextMenu: () => overlaysRef.current?.clearContextMenu(),
  });

  useEffect(() => { if (shareToken) broadcastChanges(nodes, edges); }, [nodes, edges, shareToken, broadcastChanges]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: DiagramNode) => {
    event.preventDefault();
    if (node.type === 'database' || node.type === 'external') return;
    const d = node.data as DiagramNodeData;
    overlaysRef.current?.setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id, nodeLabel: d.label });
  }, []);

  const handleNodeClick = useCallback((_e: React.MouseEvent, node: DiagramNode) => { overlaysRef.current?.setSelectedNodeId(node.id); }, []);
  const handlePaneClick = useCallback(() => { overlaysRef.current?.clearContextMenu(); overlaysRef.current?.clearSelectedNode(); }, []);

  const handleConnect = useCallback((connection: Connection) => {
    const src = nodes.find((n) => n.id === connection.source);
    const tgt = nodes.find((n) => n.id === connection.target);
    const sT = (src?.type ?? 'service') as NodeType;
    const tT = (tgt?.type ?? 'service') as NodeType;
    if (!canConnect(sT, tT)) { toast({ title: connectionErrorMessage(sT, tT), variant: 'destructive' }); return; }
    onConnectAction(connection);
  }, [onConnectAction, nodes]);

  const handleAutoLayout = useCallback((engine: string, dir: string) => {
    const direction = dir as LayoutDirection;
    if (engine === 'elk') autoLayoutELK(direction).catch(() => toast({ title: t('canvas.layoutError'), variant: 'destructive' }));
    else autoLayout(direction);
  }, [autoLayoutELK, autoLayout, t]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background" onKeyDown={handleKeyDown} tabIndex={0} role="application" aria-label="Editor de diagramas de arquitetura">
      <header className="flex items-center justify-center gap-3 border-b bg-card/80 px-4 py-2 backdrop-blur-sm">
        <DiagramToolbarStrip
          readOnly={readOnly}
          toolbar={{
            onAddNode: handleAddNode,
            onDelete: deleteSelected,
            onClearCanvas: () => modalsRef.current?.openClearConfirm(),
            onUndo: undo,
            onRedo: redo,
            onAutoLayout: handleAutoLayout,
            onExportPNG: handleExportPNG,
            onExportSVG: handleExportSVG,
            onExportMermaid: () => modalsRef.current?.openMermaid(),
            onExportJSON: handleExportJSON,
            onImportJSON: () => modalsRef.current?.openImportJSON(),
            diagramName,
            onDiagramNameChange: setDiagramName,
            darkMode,
            onToggleDarkMode: toggleDarkMode,
            allowedExportFormats: planLimits.allowedExportFormats,
            onUpgradeRequest: openUpgradeModal,
            actionsDisabled: toolbarLocked,
          }}
          header={{
            shareToken,
            diagramId: diagramId ?? null,
            isCollaborator,
            user,
            collaborators,
            saving,
            refreshing,
            onSave: handleSaveToCloud,
            onRefresh: handleRefreshDiagram,
            onSignOut: handleSignOutRequest,
            onOpenBilling: () => setBillingOpen(true),
            onOpenAccount: () => setAccountOpen(true),
            onOpenMyDiagrams: () => setMyDiagramsOpen(true),
            plan: planLimits.plan as 'free' | 'pro' | 'team',
          }}
          onOpenShortcuts={() => modalsRef.current?.openShortcuts()}
        />
      </header>

      <div className="relative flex-1" ref={reactFlowWrapper}>
        <DiagramStatusOverlays saving={saving} />
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={readOnly ? undefined : onNodesChange} onEdgesChange={readOnly ? undefined : onEdgesChange} onConnect={readOnly ? undefined : handleConnect} onNodeDrag={readOnly ? undefined : (event, node) => { onNodeDrag(event, node); onNodeDragHandler(event, node as DiagramNode); }} onNodeDragStop={readOnly ? undefined : onNodeDragStop} onNodeContextMenu={readOnly ? undefined : handleNodeContextMenu} onPaneClick={handlePaneClick} onNodeClick={handleNodeClick} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView snapToGrid={!readOnly} snapGrid={[10, 10]} nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable={!readOnly} selectionOnDrag={!readOnly && interactionMode === 'select'} panOnDrag={readOnly ? true : (interactionMode === 'select' ? [1, 2] : [0, 1, 2])} selectionMode={SelectionMode.Partial} defaultEdgeOptions={defaultEdgeOptions} proOptions={{ hideAttribution: true }}>
          <SnapGuideLines guides={guides} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
          <MiniMap className="!bg-card !border-border" nodeColor={(node) => MINIMAP_NODE_COLORS[node.type || ''] || '#888'} />
        </ReactFlow>
        {!readOnly && <CanvasOverlays ref={overlaysRef} nodes={nodes} interactionMode={interactionMode} onInteractionModeChange={handleSetInteractionMode} onSpawn={(source) => modalsRef.current?.openSpawn(source)} />}
      </div>

      <StatusBar nodes={nodes} edges={edges} saveStatus={saveStatus} />
      {!readOnly && <DiagramModals ref={modalsRef} addNodesFromSource={addNodesFromSource} loadDiagram={loadDiagram} setDiagramName={setDiagramName} clearCanvas={clearCanvas} handleExportMermaid={handleExportMermaid} onAfterImport={() => { lastLoadedUpdatedAtRef.current = null; }} />}
      <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} featureName={upgradeFeatureName} />
      <BillingModal open={billingOpen} onOpenChange={setBillingOpen} />
      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} />
      <MyDiagramsModal open={myDiagramsOpen} onOpenChange={setMyDiagramsOpen} />
      <UnsavedChangesDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen} onSaveAndLeave={handleSaveAndLeave} onLeaveWithout={handleLeaveWithout} />
    </div>
  );
}

export default function DiagramCanvas({ shareToken, readOnly }: DiagramCanvasProps = {}) {
  return <ReactFlowProvider><DiagramCanvasInner shareToken={shareToken} readOnly={readOnly} /></ReactFlowProvider>;
}
