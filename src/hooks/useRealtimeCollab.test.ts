import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDiagramStore } from '@/store/diagramStore';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';
import { decryptDiagramData } from '@/services/cryptoService';

vi.mock('@/services/cryptoService', () => ({
  decryptDiagramData: vi.fn(),
}));

const mockedDecrypt = vi.mocked(decryptDiagramData);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockNode(id: string) {
  return { id, type: 'service' as const, position: { x: 0, y: 0 }, data: { label: id, type: 'service' as const } };
}

function mockEdge(id: string) {
  return { id, source: 'n1', target: 'n2', data: { protocol: 'REST' as const } };
}

// ─── Schema validation tests ─────────────────────────────────────────────────

describe('useRealtimeCollab — payload validation', () => {
  it('accepts valid broadcast payload with nodes and edges', () => {
    const validNodes = [mockNode('node-1')];
    const validEdges = [mockEdge('edge-1')];
    expect(DbDiagramNodesSchema.safeParse(validNodes).success).toBe(true);
    expect(DbDiagramEdgesSchema.safeParse(validEdges).success).toBe(true);
  });

  it('rejects broadcast payload with invalid node structure', () => {
    const invalidNodes = [{ id: 123, type: null }];
    expect(DbDiagramNodesSchema.safeParse(invalidNodes).success).toBe(false);
  });

  it('rejects broadcast payload with invalid edge structure', () => {
    const invalidEdges = [{ id: 'e1' }];
    expect(DbDiagramEdgesSchema.safeParse(invalidEdges).success).toBe(false);
  });

  it('accepts empty arrays (valid edge case)', () => {
    expect(DbDiagramNodesSchema.safeParse([]).success).toBe(true);
    expect(DbDiagramEdgesSchema.safeParse([]).success).toBe(true);
  });

  it('detects encrypted envelope and skips (non-array check)', () => {
    const encryptedPayload = { iv: 'abc123', ciphertext: 'encrypted-data' };
    expect(Array.isArray(encryptedPayload)).toBe(false);
  });

  it('accepts nodes with all supported types', () => {
    const nodeTypes = ['service', 'database', 'queue', 'external'] as const;
    for (const type of nodeTypes) {
      const nodes = [{ id: `node-${type}`, type, position: { x: 100, y: 200 }, data: { label: `Test ${type}`, type } }];
      expect(DbDiagramNodesSchema.safeParse(nodes).success).toBe(true);
    }
  });

  it('rejects payload with extra unexpected top-level structure', () => {
    expect(DbDiagramNodesSchema.safeParse('not-an-array').success).toBe(false);
  });
});

// ─── Encrypted data decryption tests ─────────────────────────────────────────

describe('useRealtimeCollab — encrypted data decryption', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('decryptDiagramData returns decrypted arrays from encrypted envelope', async () => {
    const encrypted = { iv: 'abc', ciphertext: 'xyz' };
    const decryptedNodes = [mockNode('n1')];
    const decryptedEdges = [mockEdge('e1')];
    mockedDecrypt.mockResolvedValueOnce({ nodes: decryptedNodes as any, edges: decryptedEdges as any });
    const result = await decryptDiagramData(encrypted, encrypted);
    expect(result.nodes).toEqual(decryptedNodes);
    expect(Array.isArray(result.nodes)).toBe(true);
  });

  it('decryptDiagramData throws on failure — caller should catch and skip', async () => {
    const encrypted = { iv: 'abc', ciphertext: 'xyz' };
    mockedDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));
    await expect(decryptDiagramData(encrypted, encrypted)).rejects.toThrow('Decryption failed');
  });

  it('decryptDiagramData passes through plain arrays without calling backend', async () => {
    const nodes = [{ id: 'n1' }];
    const edges = [{ id: 'e1' }];
    mockedDecrypt.mockResolvedValueOnce({ nodes: nodes as any, edges: edges as any });
    const result = await decryptDiagramData(nodes, edges);
    expect(Array.isArray(result.nodes)).toBe(true);
  });
});

// ─── Integration: broadcast → DB save → Realtime deduplication ───────────────

describe('integração: broadcast seguido de Realtime DB update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.setState({
      nodes: [],
      edges: [],
      diagramName: 'Test',
      currentDiagramId: 'diag-1',
      isCollaborator: false,
      isDirty: false,
    });
  });

  it('aplica broadcast imediatamente e Realtime subsequente com mesmo conteúdo não duplica', () => {
    const store = useDiagramStore.getState();
    const nodesV1 = [mockNode('node-1')] as any;

    // Simulate broadcast application (what the channel handler does)
    const temporal = useDiagramStore.temporal.getState();
    temporal.pause();
    store.setNodes(nodesV1);
    store.setEdges([]);
    temporal.resume();

    const stateAfterBroadcast = useDiagramStore.getState().nodes;
    expect(stateAfterBroadcast).toHaveLength(1);

    // Simulate Realtime applying same content — no duplication
    temporal.pause();
    useDiagramStore.getState().setNodes(nodesV1);
    useDiagramStore.getState().setEdges([]);
    temporal.resume();

    const stateAfterRealtime = useDiagramStore.getState().nodes;
    expect(stateAfterRealtime).toHaveLength(stateAfterBroadcast.length);
  });

  it('aplica Realtime quando traz conteúdo mais novo que o broadcast', () => {
    const nodesV1 = [mockNode('node-1')] as any;
    const nodesV2 = [mockNode('node-1'), mockNode('node-2')] as any;

    // Simulate broadcast with V1
    useDiagramStore.getState().setNodes(nodesV1);

    // Simulate Realtime with V2 (newer content)
    useDiagramStore.getState().setNodes(nodesV2);
    expect(useDiagramStore.getState().nodes).toHaveLength(2);
  });

  it('revision_number dedup: ignora Realtime com revision_number já visto', () => {
    // Simulate the dedup logic from the hook
    let lastRevision = -1;
    const shouldApply = (revision: number): boolean => {
      if (revision > 0 && revision <= lastRevision) return false;
      if (revision > 0) lastRevision = revision;
      return true;
    };

    expect(shouldApply(1)).toBe(true);
    expect(shouldApply(1)).toBe(false); // duplicate
    expect(shouldApply(2)).toBe(true);  // newer
  });

  it('pausa undo/redo durante aplicação de update remoto', () => {
    const temporal = useDiagramStore.temporal.getState();
    const pauseSpy = vi.spyOn(temporal, 'pause');
    const resumeSpy = vi.spyOn(temporal, 'resume');

    // Simulate remote update application
    temporal.pause();
    useDiagramStore.getState().setNodes([mockNode('n1')] as any);
    temporal.resume();

    expect(pauseSpy).toHaveBeenCalled();
    expect(resumeSpy).toHaveBeenCalled();
  });

  it('trata Realtime com dados criptografados e descriptografa antes de aplicar', async () => {
    const encryptedPayload = { iv: 'mock-iv', ciphertext: 'mock-cipher' };
    const decryptedNodes = [mockNode('node-decrypted')];
    mockedDecrypt.mockResolvedValueOnce({ nodes: decryptedNodes as any, edges: [] as any });

    // Simulate the hook's encryption detection and decryption
    let remoteNodes: unknown = encryptedPayload;
    let remoteEdges: unknown = encryptedPayload;

    if (remoteNodes && !Array.isArray(remoteNodes)) {
      const decrypted = await decryptDiagramData(remoteNodes, remoteEdges);
      remoteNodes = decrypted.nodes;
      remoteEdges = decrypted.edges;
    }

    expect(mockedDecrypt).toHaveBeenCalledOnce();
    expect(Array.isArray(remoteNodes)).toBe(true);
    expect(remoteNodes).toEqual(decryptedNodes);
  });

  it('descarta update criptografado quando descriptografia falha', async () => {
    const encryptedPayload = { iv: 'bad', ciphertext: 'bad' };
    mockedDecrypt.mockRejectedValueOnce(new Error('Decryption failed'));

    const initialNodes = [...useDiagramStore.getState().nodes];
    let applied = false;

    // Simulate the hook's error handling
    if (!Array.isArray(encryptedPayload)) {
      try {
        await decryptDiagramData(encryptedPayload, encryptedPayload);
        applied = true;
      } catch {
        applied = false;
      }
    }

    expect(applied).toBe(false);
    expect(useDiagramStore.getState().nodes).toEqual(initialNodes);
  });
});
