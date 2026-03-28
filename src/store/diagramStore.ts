import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import type { DiagramNode, DiagramEdge, DiagramNodeData, NodeType } from '@/types/diagram';

import { getLayoutedElements, getELKLayoutedElements, type LayoutDirection } from '@/services/layoutService';
import { getNodeColor } from '@/utils/nodeColors';
import { canConnect } from '@/utils/connectionRules';
import i18n from '@/i18n';
import { usePlanStore } from '@/store/planStore';
// Lazy import of toast to avoid circular dependency at module load time
import { toast } from '@/hooks/use-toast';

const createNodeId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

interface DiagramState {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  diagramName: string;
  currentDiagramId: string | undefined;
  isAnalyzing: boolean;
  analysisResult: string | null;
  isCollaborator: boolean;
}

interface DiagramActions {
  setNodes: (nodes: DiagramNode[]) => void;
  setEdges: (edges: DiagramEdge[]) => void;
  setDiagramName: (name: string) => void;
  setCurrentDiagramId: (id: string | undefined) => void;
  setIsAnalyzing: (value: boolean) => void;
  setAnalysisResult: (result: string | null) => void;
  setIsCollaborator: (value: boolean) => void;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeDragHandler: (event: React.MouseEvent, node: DiagramNode) => void;

  addNode: (type: NodeType, subType?: string, position?: { x: number; y: number }, onLimitReached?: () => void) => void;
  addNodesFromSource: (sourceNodeId: string, type: NodeType, count: number, subType?: string, onLimitReached?: () => void) => void;
  deleteSelected: () => void;
  autoLayout: (direction?: LayoutDirection) => void;
  autoLayoutELK: (direction?: LayoutDirection) => Promise<void>;
  clearCanvas: () => void;
  loadDiagram: (nodes: DiagramNode[], edges: DiagramEdge[]) => void;
  exportJSON: () => string;
  
}

type DiagramStore = DiagramState & DiagramActions;

/** Slice rastreado pelo undo/redo — apenas nodes, edges e diagramName */
type UndoSlice = Pick<DiagramStore, 'nodes' | 'edges' | 'diagramName'>;

export const useDiagramStore = create<DiagramStore>()(
  temporal(
    (set, get) => ({
      // State
      nodes: [],
      edges: [],
      diagramName: i18n.t('diagram.newDiagram'),
      currentDiagramId: undefined,
      isAnalyzing: false,
      analysisResult: null,
      isCollaborator: false,

      // Setters
      // FUNC-02: setNodes also syncs edge colors when source node changes
      setNodes: (nodes) => {
        const safeNodes = Array.isArray(nodes) ? nodes : [];
        set((state) => {
          // Build a map of node id → node for quick lookup
          const nodeMap = new Map(safeNodes.map((n) => [n.id, n]));

          // R5-PERF-01: Skip edge mapping if no subType actually changed
          const hasSubTypeChange = state.edges.some((edge) => {
            const sourceNode = nodeMap.get(edge.source);
            if (!sourceNode) return false;
            const newSubType = (sourceNode.data as DiagramNodeData | undefined)?.subType;
            return newSubType !== edge.data?.sourceNodeSubType;
          });
          if (!hasSubTypeChange) return { nodes: safeNodes };

          const updatedEdges = state.edges.map((edge) => {
            const sourceNode = nodeMap.get(edge.source);
            if (!sourceNode) return edge;
            const sourceType = sourceNode.type as NodeType | undefined;
            const sourceSubType = (sourceNode.data as DiagramNodeData | undefined)?.subType;
            const targetNode = nodeMap.get(edge.target);
            const targetType = targetNode?.type as NodeType | undefined;
            const isQueueConnection = sourceType === 'queue' || targetType === 'queue';
            const newColor = isQueueConnection ? 'hsl(157, 52%, 49%)' : getNodeColor(sourceType, sourceSubType);
            const currentMarker = edge.markerEnd;
            const currentColor = typeof currentMarker === 'object' ? currentMarker?.color : undefined;
            if (currentColor === newColor && edge.data?.sourceNodeSubType === sourceSubType) return edge;
            return {
              ...edge,
              markerEnd: typeof currentMarker === 'object'
                ? { ...currentMarker, color: newColor }
                : { type: MarkerType.ArrowClosed, color: newColor },
              data: { ...edge.data, sourceNodeType: sourceType, sourceNodeSubType: sourceSubType, isQueueConnection },
            };
          });
          return { nodes: safeNodes, edges: updatedEdges };
        });
      },
      setEdges: (edges) => set({ edges: Array.isArray(edges) ? edges : [] }),
      setDiagramName: (diagramName) => set({ diagramName }),
      setCurrentDiagramId: (currentDiagramId) => set({ currentDiagramId }),
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      setAnalysisResult: (analysisResult) => set({ analysisResult }),
      setIsCollaborator: (isCollaborator) => set({ isCollaborator }),

      // QUA-05: React Flow handlers with reference comparison
      onNodesChange: (changes) => {
        if (!changes || changes.length === 0) return;
        const current = get().nodes;
        const updated = applyNodeChanges(changes, current) as DiagramNode[];
        if (updated !== current) set({ nodes: updated });
      },

      onEdgesChange: (changes) => {
        if (!changes || changes.length === 0) return;
        const current = get().edges;
        const updated = applyEdgeChanges(changes, current) as DiagramEdge[];
        if (updated !== current) set({ edges: updated });
      },

      // FUNC-03 / PERF-02: onConnect reads nodes inside set() callback, validates with canConnect
      onConnect: (connection) => {
        set((state) => {
          const sourceNode = state.nodes.find((n) => n.id === connection.source);
          const targetNode = state.nodes.find((n) => n.id === connection.target);
          const sourceType = (sourceNode?.type ?? 'service') as NodeType;
          const targetType = (targetNode?.type ?? 'service') as NodeType;

          // Defense-in-depth: validate connection rules
          if (!canConnect(sourceType, targetType)) {
            return { edges: state.edges };
          }

          const sourceSubType = (sourceNode?.data as DiagramNodeData | undefined)?.subType;
          const isQueueConnection = sourceType === 'queue' || targetType === 'queue';
          const edgeColor = isQueueConnection ? 'hsl(157, 52%, 49%)' : getNodeColor(sourceType, sourceSubType);

          const result = addEdge(
            {
              ...connection,
              type: 'editable',
              animated: false,
              style: { strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
              data: { waypoints: undefined, sourceNodeType: sourceType, sourceNodeSubType: sourceSubType, isQueueConnection },
            },
            state.edges,
          ) as DiagramEdge[];
          if (!Array.isArray(result)) {
            console.error('[Store] addEdge returned non-array:', typeof result, result);
            return { edges: state.edges };
          }
          return { edges: result };
        });
      },

      onNodeDragHandler: (_event, node) => {
        set((state) => {
          if (!Array.isArray(state.edges)) return { edges: [] };
          return {
            edges: state.edges.map((edge) => {
              const connected = edge.source === node.id || edge.target === node.id;
              if (!connected || !edge.data?.waypoints?.length) return edge;
              return { ...edge, data: { ...edge.data, waypoints: undefined } };
            }),
          };
        });
      },

      // Actions
      addNode: (type, subType, position, onLimitReached) => {
        // saas0001: enforce node limit per plan.
        // I11: getState() is used intentionally here — this action runs inside the Zustand
        // store creator, not in a React component, so hooks are unavailable. Reading planStore
        // synchronously via getState() is safe and avoids circular subscription issues.
        const { limits } = usePlanStore.getState();
        const { maxNodesPerDiagram } = limits;
        if (maxNodesPerDiagram !== null) {
          const currentCount = get().nodes.length;
          if (currentCount >= maxNodesPerDiagram) {
            toast({ title: i18n.t('limits.nodeLimitReached', { max: maxNodesPerDiagram }), variant: 'destructive' });
            onLimitReached?.();
            return;
          }
        }

        const labelMap: Record<NodeType, string> = {
          service: i18n.t('nodes.service'),
          database: subType || 'Oracle',
          queue: subType || 'IBM MQ',
          external: subType || 'REST',
        };
        const newNode: DiagramNode = {
          id: createNodeId(),
          type,
          position: position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
          data: { label: labelMap[type], type, subType, internalDatabases: [], internalServices: [] },
        };
        set((state) => ({ nodes: [...state.nodes, newNode] }));
      },

      addNodesFromSource: (sourceNodeId, type, count, subType, onLimitReached) => {
        // saas0001: same cross-store read rationale as addNode above (I11)
        const { limits } = usePlanStore.getState();
        const { maxNodesPerDiagram } = limits;
        const { nodes: currentNodes } = get();
        if (maxNodesPerDiagram !== null && currentNodes.length + count > maxNodesPerDiagram) {
          toast({ title: i18n.t('limits.nodeLimitReached', { max: maxNodesPerDiagram }), variant: 'destructive' });
          onLimitReached?.();
          return;
        }

        const { nodes } = get();
        const sourceNode = nodes.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return;

        const sourceData: DiagramNodeData = sourceNode.data;

        // Embed Oracle inside service
        if (type === 'database' && subType === 'Oracle' && sourceNode.type === 'service') {
          const currentDbs = sourceData.internalDatabases || [];
          const newDbs = [...currentDbs];
          for (let i = 0; i < count; i++) {
            newDbs.push(`Oracle ${currentDbs.length + i + 1}`);
          }
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === sourceNodeId ? { ...n, data: { ...n.data, internalDatabases: newDbs } } : n
            ),
          }));
          return;
        }

        // Embed library inside service (triggered by subType === 'library')
        if (type === 'service' && subType === 'library' && sourceNode.type === 'service') {
          const currentSvcs = sourceData.internalServices || [];
          const newSvcs = [...currentSvcs];
          for (let i = 0; i < count; i++) {
            newSvcs.push(i18n.t('nodePanel.libDefault', { n: currentSvcs.length + i + 1 }));
          }
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === sourceNodeId ? { ...n, data: { ...n.data, internalServices: newSvcs } } : n
            ),
          }));
          return;
        }

        const labelMap: Record<NodeType, string> = {
          service: i18n.t('nodes.service'),
          database: subType || 'Oracle',
          queue: subType || 'IBM MQ',
          external: subType || 'REST',
        };

        const newNodes: DiagramNode[] = [];

        for (let i = 0; i < count; i++) {
          const id = createNodeId();
          newNodes.push({
            id,
            type,
            position: {
              x: sourceNode.position.x + 250,
              y: sourceNode.position.y + i * 120 - ((count - 1) * 60),
            },
            data: { label: `${labelMap[type]} ${count > 1 ? i + 1 : ''}`.trim(), type, subType, internalDatabases: [], internalServices: [] },
          });
        }

        set((state) => ({
          nodes: [...state.nodes, ...newNodes],
        }));
      },

      deleteSelected: () => {
        set((state) => {
          const safeNodes = Array.isArray(state.nodes) ? state.nodes : [];
          const safeEdges = Array.isArray(state.edges) ? state.edges : [];
          const selectedNodeIds = new Set(safeNodes.filter((n) => n.selected).map((n) => n.id));
          return {
            nodes: safeNodes.filter((n) => !n.selected),
            edges: safeEdges.filter(
              (e) => !e.selected && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
            ),
          };
        });
      },

      autoLayout: (direction: LayoutDirection = 'LR') => {
        const { nodes, edges } = get();
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction as 'TB' | 'LR');
        set({ nodes: Array.isArray(layoutedNodes) ? layoutedNodes : [], edges: Array.isArray(layoutedEdges) ? layoutedEdges : [] });
      },

      autoLayoutELK: async (direction: LayoutDirection = 'LR') => {
        const { nodes, edges } = get();
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getELKLayoutedElements(nodes, edges, direction);
        set({ nodes: Array.isArray(layoutedNodes) ? layoutedNodes : [], edges: Array.isArray(layoutedEdges) ? layoutedEdges : [] });
      },

      clearCanvas: () => set({ nodes: [], edges: [], isCollaborator: false, currentDiagramId: undefined }),

      loadDiagram: (nodes, edges) => set({ nodes: Array.isArray(nodes) ? nodes : [], edges: Array.isArray(edges) ? edges : [], isCollaborator: false }),

      // PERF-03: Project only essential fields in exported JSON
      exportJSON: () => {
        const { diagramName, nodes, edges } = get();
        const projectedNodes = nodes.map(({ id, type, position, data }) => ({ id, type, position, data }));
        const projectedEdges = edges.map(({ id, source, target, type, animated, style, markerEnd, data, label }) => ({
          id, source, target, type, animated, style, markerEnd, data, label,
        }));
        return JSON.stringify({ name: diagramName, nodes: projectedNodes, edges: projectedEdges }, null, 2);
      },

    }),
    {
      limit: 50,
      equality: (pastState, currentState) =>
        pastState.nodes === currentState.nodes &&
        pastState.edges === currentState.edges &&
        pastState.diagramName === currentState.diagramName,
      partialize: (state): DiagramStore =>
        ({
          nodes: state.nodes,
          edges: state.edges,
          diagramName: state.diagramName,
        } as unknown as DiagramStore), // zundo exige o tipo completo DiagramStore; apenas UndoSlice é rastreado
    },
  ),
);
