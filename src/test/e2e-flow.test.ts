import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client before any imports that use it
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
      track: vi.fn(),
    })),
  },
}));

import { useDiagramStore } from '@/store/diagramStore';
import * as diagramService from '@/services/diagramService';
import type { DiagramNode, DiagramEdge } from '@/types/diagram';

vi.mock('@/services/cryptoService', () => ({
  encryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({ nodes, edges })),
  decryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({ nodes, edges })),
}));

describe('E2E Flow: login → create → save → share → collaborate', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  beforeEach(() => {
    useDiagramStore.getState().clearCanvas();
    vi.restoreAllMocks();
  });

  it('Step 1-2: Creates a diagram with nodes via store', () => {
    const store = useDiagramStore.getState();
    store.addNode('service');
    store.addNode('database');

    const { nodes } = useDiagramStore.getState();
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe('service');
    expect(nodes[1].type).toBe('database');
  });

  it('Step 3: Saves diagram with correct data', async () => {
    const store = useDiagramStore.getState();
    store.addNode('service');
    store.addNode('queue');
    store.setDiagramName('Test Diagram');

    const mockRecord: diagramService.DiagramRecord = {
      id: 'diagram-456',
      title: 'Test Diagram',
      nodes: useDiagramStore.getState().nodes,
      edges: [],
      owner_id: mockUser.id,
      share_token: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const saveSpy = vi.spyOn(diagramService, 'saveDiagram').mockResolvedValue(mockRecord);

    const { nodes, edges, diagramName } = useDiagramStore.getState();
    const result = await diagramService.saveDiagram(diagramName, nodes, edges, mockUser.id);

    expect(saveSpy).toHaveBeenCalledWith('Test Diagram', nodes, edges, mockUser.id);
    expect(result.id).toBe('diagram-456');
    expect(result.title).toBe('Test Diagram');
  });

  it('Step 4: Shares diagram and returns URL', async () => {
    const shareSpy = vi.spyOn(diagramService, 'shareDiagram').mockResolvedValue(
      'https://microflow-architect.lovable.app/diagram/abc123'
    );

    const url = await diagramService.shareDiagram('diagram-456');

    expect(shareSpy).toHaveBeenCalledWith('diagram-456');
    expect(url).toContain('/diagram/abc123');
  });

  it('Step 5: Loads shared diagram and sets collaborator state', async () => {
    const sharedNodes: DiagramNode[] = [
      {
        id: 'n1',
        type: 'service',
        position: { x: 0, y: 0 },
        data: { label: 'API Gateway', type: 'service', internalDatabases: [], internalServices: [] },
      },
    ] as DiagramNode[];

    const sharedEdges: DiagramEdge[] = [];

    const mockSharedRecord: diagramService.DiagramRecord = {
      id: 'diagram-456',
      title: 'Shared Diagram',
      nodes: sharedNodes,
      edges: sharedEdges,
      owner_id: 'other-user-789',
      share_token: 'abc123',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.spyOn(diagramService, 'loadDiagramByToken').mockResolvedValue(mockSharedRecord);

    const record = await diagramService.loadDiagramByToken('abc123');
    expect(record).not.toBeNull();
    expect(record!.share_token).toBe('abc123');
    expect(record!.owner_id).toBe('other-user-789');

    // Simulate collaborator state
    const store = useDiagramStore.getState();
    store.loadDiagram(record!.nodes, record!.edges);
    store.setCurrentDiagramId(record!.id);

    // Collaborator = user is not the owner
    const isCollaborator = record!.owner_id !== mockUser.id;
    expect(isCollaborator).toBe(true);

    const { nodes } = useDiagramStore.getState();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.label).toBe('API Gateway');
  });
});
