import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from './diagramStore';
import type { ExternalCategory, DiagramNodeData } from '@/types/diagram';
import {
  deleteDiagram,
  renameDiagram,
  saveSharedDiagram,
} from '@/services/diagramService';

const { getState } = useDiagramStore;

function resetStore() {
  getState().clearCanvas();
  getState().setDiagramName('Novo Diagrama');
  // Clear undo history
  useDiagramStore.temporal.getState().clear();
}

describe('diagramStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addNode', () => {
    it('should add a service node', () => {
      getState().addNode('service');
      expect(getState().nodes).toHaveLength(1);
      expect(getState().nodes[0].type).toBe('service');
    });

    it('should add a database node with subType', () => {
      getState().addNode('database', 'Redis');
      const node = getState().nodes[0];
      expect(node.type).toBe('database');
      expect((node.data as DiagramNodeData).subType).toBe('Redis');
    });

    it('should add a queue node with Kafka subType', () => {
      getState().addNode('queue', 'Kafka');
      const node = getState().nodes[0];
      expect(node.type).toBe('queue');
      expect((node.data as DiagramNodeData).subType).toBe('Kafka');
      expect((node.data as DiagramNodeData).label).toBe('Kafka');
    });

    it('should add an external node with gRPC subType', () => {
      getState().addNode('external', 'gRPC');
      const node = getState().nodes[0];
      expect(node.type).toBe('external');
      expect((node.data as DiagramNodeData).subType).toBe('gRPC');
      expect((node.data as DiagramNodeData).label).toBe('gRPC');
    });
  });

  describe('deleteSelected', () => {
    it('should remove selected nodes and connected edges', () => {
      getState().addNode('service');
      getState().addNode('service');
      const [n1, n2] = getState().nodes;

      getState().setNodes(
        getState().nodes.map((n) => (n.id === n1.id ? { ...n, selected: true } : n))
      );

      getState().setEdges([
        { id: 'e1', source: n1.id, target: n2.id, type: 'editable', data: { waypoints: undefined } },
      ]);

      getState().deleteSelected();
      expect(getState().nodes).toHaveLength(1);
      expect(getState().nodes[0].id).toBe(n2.id);
      expect(getState().edges).toHaveLength(0);
    });
  });

  describe('clearCanvas', () => {
    it('should result in empty arrays', () => {
      getState().addNode('service');
      getState().addNode('database', 'Oracle');
      expect(getState().nodes).toHaveLength(2);

      getState().clearCanvas();
      expect(getState().nodes).toHaveLength(0);
      expect(getState().edges).toHaveLength(0);
    });

    it('deve resetar currentDiagramId para undefined', () => {
      getState().setCurrentDiagramId('diag-123');
      getState().clearCanvas();
      expect(getState().currentDiagramId).toBeUndefined();
    });
  });

  describe('setDiagramName', () => {
    it('should update the diagram name', () => {
      getState().setDiagramName('Meu Diagrama');
      expect(getState().diagramName).toBe('Meu Diagrama');
    });
  });

  describe('exportJSON', () => {
    it('should export valid JSON with name, nodes, edges', () => {
      getState().setDiagramName('Test');
      getState().addNode('service');
      const json = getState().exportJSON();
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('Test');
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.edges).toHaveLength(0);
    });

    it('should exclude volatile fields (selected, dragging, measured) from exported nodes', () => {
      getState().addNode('service');
      // Simulate React Flow adding volatile properties
      const nodesWithVolatile = getState().nodes.map((n) => ({
        ...n,
        selected: true,
        dragging: false,
        measured: { width: 200, height: 100 },
        resizing: false,
      }));
      getState().loadDiagram(nodesWithVolatile as any, []);

      const json = getState().exportJSON();
      const parsed = JSON.parse(json);
      const exportedNode = parsed.nodes[0];

      // Only essential fields should be present
      expect(exportedNode).toHaveProperty('id');
      expect(exportedNode).toHaveProperty('type');
      expect(exportedNode).toHaveProperty('position');
      expect(exportedNode).toHaveProperty('data');

      // Volatile fields must NOT be present
      expect(exportedNode).not.toHaveProperty('selected');
      expect(exportedNode).not.toHaveProperty('dragging');
      expect(exportedNode).not.toHaveProperty('measured');
      expect(exportedNode).not.toHaveProperty('resizing');
    });

    it('should exclude volatile fields from exported edges', () => {
      getState().addNode('service');
      getState().addNode('database');
      const nodes = getState().nodes;
      // Manually add an edge with volatile fields
      const edgeWithVolatile = {
        id: 'e-test',
        source: nodes[0].id,
        target: nodes[1].id,
        type: 'default',
        data: { protocol: 'REST' },
        selected: true,
        interactionWidth: 20,
      };
      getState().loadDiagram(nodes, [edgeWithVolatile] as any);

      const json = getState().exportJSON();
      const parsed = JSON.parse(json);
      const exportedEdge = parsed.edges[0];

      expect(exportedEdge).toHaveProperty('id');
      expect(exportedEdge).toHaveProperty('source');
      expect(exportedEdge).toHaveProperty('target');
      expect(exportedEdge).not.toHaveProperty('selected');
      expect(exportedEdge).not.toHaveProperty('interactionWidth');
    });
  });

  describe('loadDiagram', () => {
    it('should replace nodes and edges', () => {
      getState().addNode('service');
      const mockNodes = [
        { id: 'a', type: 'service' as const, position: { x: 0, y: 0 }, data: { label: 'A', type: 'service' as const } },
        { id: 'b', type: 'queue' as const, position: { x: 100, y: 0 }, data: { label: 'B', type: 'queue' as const } },
      ];
      getState().loadDiagram(mockNodes as any, []);
      expect(getState().nodes).toHaveLength(2);
      expect(getState().nodes[0].id).toBe('a');
    });
  });

  describe('undo/redo (zundo)', () => {
    it('should undo addNode and restore previous state', () => {
      expect(getState().nodes).toHaveLength(0);

      getState().addNode('service');
      expect(getState().nodes).toHaveLength(1);

      useDiagramStore.temporal.getState().undo();
      expect(getState().nodes).toHaveLength(0);
    });

    it('should redo after undo', () => {
      getState().addNode('service');
      useDiagramStore.temporal.getState().undo();
      expect(getState().nodes).toHaveLength(0);

      useDiagramStore.temporal.getState().redo();
      expect(getState().nodes).toHaveLength(1);
    });
  });

  describe('addNodesFromSource', () => {
    it('cria nós sem conexão automática entre eles', () => {
      getState().addNode('service');
      const sourceId = getState().nodes[0].id;
      getState().addNodesFromSource(sourceId, 'queue', 1, 'Kafka');
      expect(getState().nodes).toHaveLength(2);
      expect(getState().edges).toHaveLength(0);
    });

    it('cria múltiplos nós sem conexões automáticas', () => {
      getState().addNode('queue', 'Kafka');
      const sourceId = getState().nodes[0].id;
      getState().addNodesFromSource(sourceId, 'service', 3);
      expect(getState().nodes).toHaveLength(4);
      expect(getState().edges).toHaveLength(0);
    });

    it('should embed Oracle database inside service node', () => {
      getState().addNode('service');
      const source = getState().nodes[0];

      getState().addNodesFromSource(source.id, 'database', 1, 'Oracle');
      expect(getState().nodes).toHaveLength(1);
      expect((getState().nodes[0].data as DiagramNodeData).internalDatabases).toHaveLength(1);
      expect(getState().edges).toHaveLength(0);
    });
  });

  describe('onConnect', () => {
    it('should create an edge between two nodes', () => {
      getState().addNode('service');
      getState().addNode('service');
      const [n1, n2] = getState().nodes;

      getState().onConnect({
        source: n1.id,
        target: n2.id,
        sourceHandle: null,
        targetHandle: null,
      });

      expect(getState().edges).toHaveLength(1);
      expect(getState().edges[0].source).toBe(n1.id);
      expect(getState().edges[0].target).toBe(n2.id);
    });

    it('should create edge for service→queue without protocol labels', () => {
      getState().addNode('service');
      getState().addNode('queue', 'MQ');
      const [svc, queue] = getState().nodes;

      getState().onConnect({
        source: svc.id,
        target: queue.id,
        sourceHandle: null,
        targetHandle: null,
      });

      expect(getState().edges).toHaveLength(1);
      expect(getState().edges[0].source).toBe(svc.id);
      expect(getState().edges[0].target).toBe(queue.id);
    });

    // FUNC-03: onConnect blocks invalid connections
    it('onConnect bloqueia conexão database→queue', () => {
      getState().addNode('database', 'Oracle');
      getState().addNode('queue', 'Kafka');
      const [db, queue] = getState().nodes;

      getState().onConnect({
        source: db.id,
        target: queue.id,
        sourceHandle: null,
        targetHandle: null,
      });

      expect(getState().edges).toHaveLength(0);
    });

    it('should create edge for queue→service without protocol labels', () => {
      getState().addNode('queue', 'MQ');
      getState().addNode('service');
      const [queue, svc] = getState().nodes;

      getState().onConnect({
        source: queue.id,
        target: svc.id,
        sourceHandle: null,
        targetHandle: null,
      });

      expect(getState().edges).toHaveLength(1);
      expect(getState().edges[0].source).toBe(queue.id);
    });
  });

  describe('node rename via setNodes (undo/redo)', () => {
    it('should capture label change in undo history', () => {
      getState().addNode('service');
      const node = getState().nodes[0];
      const originalLabel = (node.data as DiagramNodeData).label;
      getState().setNodes(
        getState().nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, label: 'Novo Nome' } } : n
        )
      );
      expect((getState().nodes[0].data as DiagramNodeData).label).toBe('Novo Nome');
      useDiagramStore.temporal.getState().undo();
      expect((getState().nodes[0].data as DiagramNodeData).label).toBe(originalLabel);
    });
  });


  describe('setDiagramName undo/redo', () => {
    it('reverte nome completo com um único undo', () => {
      getState().setDiagramName('Diagrama Antigo');
      useDiagramStore.temporal.getState().clear();

      getState().setDiagramName('Diagrama Novo');
      expect(getState().diagramName).toBe('Diagrama Novo');

      useDiagramStore.temporal.getState().undo();
      expect(getState().diagramName).toBe('Diagrama Antigo');
    });

    it('duas renomeações distintas geram dois passos de undo independentes', () => {
      getState().setDiagramName('Nome A');
      getState().setDiagramName('Nome B');

      expect(getState().diagramName).toBe('Nome B');

      useDiagramStore.temporal.getState().undo();
      expect(getState().diagramName).toBe('Nome A');

      useDiagramStore.temporal.getState().undo();
      expect(getState().diagramName).toBe('Novo Diagrama');
    });
  });

  describe('externalCategory undo/redo', () => {
    it('captura mudança de externalCategory no histórico', () => {
      getState().addNode('external', 'REST');
      const nodeId = getState().nodes[0].id;

      getState().setNodes(
        getState().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, externalCategory: 'Payment' } } : n
        )
      );
      expect((getState().nodes[0].data as DiagramNodeData).externalCategory).toBe('Payment');

      useDiagramStore.temporal.getState().undo();
      expect((getState().nodes[0].data as DiagramNodeData).externalCategory).toBeUndefined();

      useDiagramStore.temporal.getState().redo();
      expect((getState().nodes[0].data as DiagramNodeData).externalCategory).toBe('Payment');
    });

    it('captura múltiplas mudanças de externalCategory consecutivas', () => {
      getState().addNode('external');
      const nodeId = getState().nodes[0].id;

      const setCategory = (cat: ExternalCategory) =>
        useDiagramStore.getState().setNodes(
          useDiagramStore.getState().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, externalCategory: cat } } : n
          )
        );

      setCategory('API');
      setCategory('Auth');
      setCategory('CDN');

      expect((getState().nodes[0].data as DiagramNodeData).externalCategory).toBe('CDN');

      useDiagramStore.temporal.getState().undo();
      expect((getState().nodes[0].data as DiagramNodeData).externalCategory).toBe('Auth');
    });
  });

  // Épico 13 — Bloco 1: label sync source of truth
  describe('addNode label sync source of truth', () => {
    it('setNodes atualiza label no store corretamente', () => {
      getState().addNode('service');
      const nodeId = getState().nodes[0].id;
      getState().setNodes(
        getState().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label: 'Nome Atualizado' } } : n
        )
      );
      expect((getState().nodes[0].data as DiagramNodeData).label).toBe('Nome Atualizado');
    });

    it('undo restaura label anterior no store', () => {
      getState().addNode('service');
      const nodeId = getState().nodes[0].id;
      const originalLabel = (getState().nodes[0].data as DiagramNodeData).label;
      getState().setNodes(
        getState().nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label: 'Novo Label' } } : n
        )
      );
      useDiagramStore.temporal.getState().undo();
      expect((getState().nodes[0].data as DiagramNodeData).label).toBe(originalLabel);
    });
  });

  // Épico 13 — Bloco 2: undo history isolation for remote updates
  describe('undo history isolation for remote updates', () => {
    it('setNodes após pause/resume não cria entrada de undo', () => {
      getState().addNode('service');
      useDiagramStore.temporal.getState().clear();

      useDiagramStore.temporal.getState().pause();
      getState().setNodes(
        getState().nodes.map((n) => ({ ...n, data: { ...n.data, label: 'Atualização Remota' } }))
      );
      useDiagramStore.temporal.getState().resume();

      expect((getState().nodes[0].data as DiagramNodeData).label).toBe('Atualização Remota');

      useDiagramStore.temporal.getState().undo();
      // Label should remain because the change was not recorded in history
      expect((getState().nodes[0].data as DiagramNodeData).label).toBe('Atualização Remota');
    });
  });

  // Épico 13 — Bloco 3: isCollaborator flag
  describe('isCollaborator flag', () => {
    it('setIsCollaborator define o valor corretamente', () => {
      expect(getState().isCollaborator).toBe(false);
      getState().setIsCollaborator(true);
      expect(getState().isCollaborator).toBe(true);
    });

    it('clearCanvas reseta isCollaborator para false', () => {
      getState().setIsCollaborator(true);
      getState().clearCanvas();
      expect(getState().isCollaborator).toBe(false);
    });

    it('loadDiagram reseta isCollaborator para false', () => {
      getState().setIsCollaborator(true);
      getState().loadDiagram([], []);
      expect(getState().isCollaborator).toBe(false);
    });
  });

  // Épico 13 — Bloco 4: addNode position parameter
  describe('addNode position parameter', () => {
    it('usa posição fornecida quando passada como argumento', () => {
      getState().addNode('service', undefined, { x: 500, y: 300 });
      const node = getState().nodes[0];
      expect(node.position.x).toBe(500);
      expect(node.position.y).toBe(300);
    });

    it('usa posição aleatória quando posição não é fornecida', () => {
      getState().addNode('service');
      const node = getState().nodes[0];
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    });
  });
});

// ── Épico 8: Testes de contratos de segurança ──────────────────────────────

describe('deleteDiagram signature (security contract)', () => {
  it('deleteDiagram aceita dois argumentos: id e ownerId', () => {
    expect(typeof deleteDiagram).toBe('function');
    expect(deleteDiagram.length).toBe(2);
  });
});

describe('renameDiagram signature (security contract)', () => {
  it('renameDiagram aceita três argumentos: id, title e ownerId', () => {
    expect(typeof renameDiagram).toBe('function');
    expect(renameDiagram.length).toBe(3);
  });
});

describe('saveSharedDiagram signature (security contract)', () => {
  it('saveSharedDiagram aceita exatamente três argumentos: diagramId, nodes, edges', () => {
    expect(typeof saveSharedDiagram).toBe('function');
    expect(saveSharedDiagram.length).toBe(3);
  });
});
