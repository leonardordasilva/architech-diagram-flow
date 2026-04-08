import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  type Connection,
} from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { useSnapGuides } from '@/hooks/useSnapGuides';
import SnapGuideLines from '@/components/SnapGuideLines';
import { toast } from '@/hooks/use-toast';
import { useDiagramStore } from '@/store/diagramStore';

import ServiceNode from '@/components/nodes/ServiceNode';
import DatabaseNode from '@/components/nodes/DatabaseNode';
import QueueNode from '@/components/nodes/QueueNode';
import ExternalNode from '@/components/nodes/ExternalNode';
import EditableEdge from '@/components/edges/EditableEdge';
import Toolbar from '@/components/Toolbar';
import type { DiagramNodeData, DiagramNode, DiagramEdge, NodeType } from '@/types/diagram';
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
import { useWorkspaceStore } from '@/store/workspaceStore';
import RecoveryBanner from '@/components/RecoveryBanner';
import DiagramHeader from '@/components/DiagramHeader';
import UpgradeModal from '@/components/UpgradeModal';
import WorkspaceContextSelector from '@/components/WorkspaceContextSelector';
import BillingModal from '@/components/BillingModal';
import AccountModal from '@/components/AccountModal';
import MyDiagramsModal from '@/pages/MyDiagrams';

import { canConnect, connectionErrorMessage } from '@/utils/connectionRules';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import StatusBar from '@/components/StatusBar';

// Extracted hooks
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useThemeToggle } from '@/hooks/useThemeToggle';
import { useInteractionMode } from '@/hooks/useInteractionMode';
import { useDiagramRefresh } from '@/hooks/useDiagramRefresh';
import { useAddNodeToCanvas } from '@/hooks/useAddNodeToCanvas';

const nodeTypes = {
  service: ServiceNode,
  database: DatabaseNode,
  queue: QueueNode,
  external: ExternalNode,
};

const edgeTypes = { editable: EditableEdge };

// R5-PERF-02: Static minimap color map (outside component)
const MINIMAP_NODE_COLORS: Record<string, string> = {
  service: 'hsl(217, 91%, 60%)',
  database: 'hsl(142, 71%, 45%)',
  queue: 'hsl(45, 93%, 47%)',
  external: 'hsl(220, 9%, 46%)',
};

interface DiagramCanvasProps {
  shareToken?: string;
  /** When true, all editing is disabled (read-only shared view) */
  readOnly?: boolean;
}

function DiagramCanvasInner({ shareToken, readOnly = false }: DiagramCanvasProps) {
  const { t } = useTranslation();

  // ITEM 6: Grouped Zustand selectors with useShallow
  const { nodes, edges, diagramName, diagramId, isCollaborator } = useDiagramStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      diagramName: s.diagramName,
      diagramId: s.currentDiagramId,
      isCollaborator: s.isCollaborator,
    })),
  );

  const { setDiagramName, onNodesChange, onEdgesChange, onConnect: onConnectAction, onNodeDragHandler, addNodesFromSource, deleteSelected, autoLayout, autoLayoutELK, clearCanvas, loadDiagram } = useDiagramStore(
    useShallow((s) => ({
      setDiagramName: s.setDiagramName,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      onNodeDragHandler: s.onNodeDragHandler,
      addNodesFromSource: s.addNodesFromSource,
      deleteSelected: s.deleteSelected,
      autoLayout: s.autoLayout,
      autoLayoutELK: s.autoLayoutELK,
      clearCanvas: s.clearCanvas,
      loadDiagram: s.loadDiagram,
    })),
  );

  const { user, signOut } = useAuth();

  // saas0001: plan limits
  const planLimits = usePlanLimits();
  // saas0003: workspace context
  useWorkspace();
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('');
  const [billingOpen, setBillingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [myDiagramsOpen, setMyDiagramsOpen] = useState(false);

  const openUpgradeModal = useCallback((featureName: string) => {
    setUpgradeFeatureName(featureName);
    setUpgradeModalOpen(true);
  }, []);

  // Block toolbar when logged-in user has an unsaved canvas and has reached the diagram limit
  const { data: diagramCount } = useQuery({
    queryKey: ['diagram-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_diagram_count', { p_user_id: user!.id });
      return (data as number) ?? 0;
    },
    enabled: !!user && !diagramId && planLimits.maxDiagrams !== null,
    staleTime: 30_000,
  });
  const toolbarLocked = !!user && !diagramId && planLimits.maxDiagrams !== null && diagramCount !== undefined && diagramCount >= planLimits.maxDiagrams;

  const { save: handleSaveToCloud, saving, saveRef: handleSaveToCloudRef } = useSaveDiagram({
    shareToken,
    onDiagramLimitReached: () => openUpgradeModal('Diagramas ilimitados'),
  });

  // Extracted hooks
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
    onSave: () => handleSaveToCloudRef.current?.(),
    onOpenShortcuts: () => modalsRef.current?.openShortcuts(),
    onClearSelectedNode: () => overlaysRef.current?.clearSelectedNode(),
    onClearContextMenu: () => overlaysRef.current?.clearContextMenu(),
  });

  useEffect(() => {
    if (shareToken) broadcastChanges(nodes, edges);
  }, [nodes, edges, shareToken, broadcastChanges]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: DiagramNode) => {
    event.preventDefault();
    if (node.type === 'database' || node.type === 'external') return;
    const nodeData = node.data as DiagramNodeData;
    overlaysRef.current?.setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id, nodeLabel: nodeData.label });
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: DiagramNode) => {
    overlaysRef.current?.setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    overlaysRef.current?.clearContextMenu();
    overlaysRef.current?.clearSelectedNode();
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    const srcType = (sourceNode?.type ?? 'service') as NodeType;
    const tgtType = (targetNode?.type ?? 'service') as NodeType;
    if (!canConnect(srcType, tgtType)) {
      toast({ title: connectionErrorMessage(srcType, tgtType), variant: 'destructive' });
      return;
    }
    onConnectAction(connection);
  }, [onConnectAction, nodes]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background" onKeyDown={handleKeyDown} tabIndex={0} role="application" aria-label="Editor de diagramas de arquitetura">
      <header className="flex items-center justify-center gap-3 border-b bg-card/80 px-4 py-2 backdrop-blur-sm">
        {!readOnly && (
        <Toolbar
          onAddNode={handleAddNode}
          onDelete={deleteSelected}
          onClearCanvas={() => modalsRef.current?.openClearConfirm()}
          onUndo={undo}
          onRedo={redo}
          onAutoLayout={(engine, direction) => {
            if (engine === 'elk') {
              autoLayoutELK(direction as any).catch(() => toast({ title: t('canvas.layoutError'), variant: 'destructive' }));
            } else {
              autoLayout(direction as any);
            }
          }}
          onExportPNG={handleExportPNG}
          onExportSVG={handleExportSVG}
          onExportMermaid={() => modalsRef.current?.openMermaid()}
          onExportJSON={handleExportJSON}
          onImportJSON={() => modalsRef.current?.openImportJSON()}
          diagramName={diagramName}
          onDiagramNameChange={setDiagramName}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          allowedExportFormats={planLimits.allowedExportFormats}
          onUpgradeRequest={openUpgradeModal}
          actionsDisabled={toolbarLocked}
        />
        )}
        {!readOnly && <WorkspaceContextSelector />}
        {!readOnly && (
          <>
            <DiagramHeader
              shareToken={shareToken}
              diagramId={diagramId ?? null}
              isCollaborator={isCollaborator}
              user={user}
              collaborators={collaborators}
              saving={saving}
              refreshing={refreshing}
              onSave={handleSaveToCloud}
              onRefresh={handleRefreshDiagram}
              onSignOut={signOut}
              onOpenBilling={() => setBillingOpen(true)}
              onOpenAccount={() => setAccountOpen(true)}
              onOpenMyDiagrams={() => setMyDiagramsOpen(true)}
              plan={planLimits.plan}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => modalsRef.current?.openShortcuts()} aria-label={t('canvas.keyboardShortcuts')}>
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{t('canvas.keyboardShortcutsBtn')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </header>

      <div className="relative flex-1" ref={reactFlowWrapper}>
        <RecoveryBanner />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : handleConnect}
          onNodeDrag={readOnly ? undefined : (event, node) => { onNodeDrag(event, node); onNodeDragHandler(event, node as any); }}
          onNodeDragStop={readOnly ? undefined : onNodeDragStop}
          onNodeContextMenu={readOnly ? undefined : handleNodeContextMenu}
          onPaneClick={handlePaneClick}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          snapToGrid={!readOnly}
          snapGrid={[10, 10]}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          selectionOnDrag={!readOnly && interactionMode === 'select'}
          panOnDrag={readOnly ? true : (interactionMode === 'select' ? [1, 2] : [0, 1, 2])}
          selectionMode={SelectionMode.Partial}
          defaultEdgeOptions={{ type: 'editable', animated: true, style: { strokeWidth: 2 }, data: { waypoints: undefined } }}
          proOptions={{ hideAttribution: true }}
        >
          <SnapGuideLines guides={guides} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls className="!bg-card !border-border !shadow-md [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
          <MiniMap className="!bg-card !border-border" nodeColor={(node) => MINIMAP_NODE_COLORS[node.type || ''] || '#888'} />
        </ReactFlow>

        {!readOnly && (
          <CanvasOverlays
            ref={overlaysRef}
            nodes={nodes}
            interactionMode={interactionMode}
            onInteractionModeChange={handleSetInteractionMode}
            onSpawn={(source) => modalsRef.current?.openSpawn(source)}
          />
        )}
      </div>

      <StatusBar nodes={nodes} edges={edges} saveStatus={saveStatus} />

      {!readOnly && (
        <DiagramModals
          ref={modalsRef}
          addNodesFromSource={addNodesFromSource}
          loadDiagram={loadDiagram}
          setDiagramName={setDiagramName}
          clearCanvas={clearCanvas}
          handleExportMermaid={handleExportMermaid}
          onAfterImport={() => { lastLoadedUpdatedAtRef.current = null; }}
        />
      )}

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        featureName={upgradeFeatureName}
      />

      <BillingModal open={billingOpen} onOpenChange={setBillingOpen} />
      <AccountModal open={accountOpen} onOpenChange={setAccountOpen} />
      <MyDiagramsModal open={myDiagramsOpen} onOpenChange={setMyDiagramsOpen} />
    </div>
  );
}

export default function DiagramCanvas({ shareToken, readOnly }: DiagramCanvasProps = {}) {
  return (
    <ReactFlowProvider>
      <DiagramCanvasInner shareToken={shareToken} readOnly={readOnly} />
    </ReactFlowProvider>
  );
}
