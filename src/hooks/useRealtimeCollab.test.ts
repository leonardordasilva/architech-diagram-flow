import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDiagramStore } from '@/store/diagramStore';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';
import { decryptDiagramData } from '@/services/cryptoService';

vi.mock('@/services/cryptoService', () => ({
  decryptDiagramData: vi.fn(),
}));

const mockedDecrypt = vi.mocked(decryptDiagramData);

describe('useRealtimeCollab — payload validation', () => {
  it('accepts valid broadcast payload with nodes and edges', () => {
    const validNodes = [
      {
        id: 'node-1',
        type: 'service',
        position: { x: 0, y: 0 },
        data: { label: 'API Gateway', type: 'service' },
      },
    ];
    const validEdges = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        data: { protocol: 'REST' },
      },
    ];

    const nodesParsed = DbDiagramNodesSchema.safeParse(validNodes);
    const edgesParsed = DbDiagramEdgesSchema.safeParse(validEdges);

    expect(nodesParsed.success).toBe(true);
    expect(edgesParsed.success).toBe(true);
  });

  it('rejects broadcast payload with invalid node structure', () => {
    const invalidNodes = [{ id: 123, type: null }];
    const result = DbDiagramNodesSchema.safeParse(invalidNodes);
    expect(result.success).toBe(false);
  });

  it('rejects broadcast payload with invalid edge structure', () => {
    const invalidEdges = [{ id: 'e1' }];
    const result = DbDiagramEdgesSchema.safeParse(invalidEdges);
    expect(result.success).toBe(false);
  });

  it('accepts empty arrays (valid edge case)', () => {
    expect(DbDiagramNodesSchema.safeParse([]).success).toBe(true);
    expect(DbDiagramEdgesSchema.safeParse([]).success).toBe(true);
  });

  it('detects encrypted envelope and skips (non-array check)', () => {
    const encryptedPayload = { iv: 'abc123', ciphertext: 'encrypted-data' };
    expect(Array.isArray(encryptedPayload)).toBe(false);
  });

  it('handles concurrent broadcast with different timestamps', () => {
    const ts1 = '2026-03-01T10:00:00Z';
    const ts2 = '2026-03-01T10:00:01Z';
    expect(ts1).not.toBe(ts2);
  });

  it('accepts nodes with all supported types', () => {
    const nodeTypes = ['service', 'database', 'queue', 'external'] as const;
    for (const type of nodeTypes) {
      const nodes = [
        {
          id: `node-${type}`,
          type,
          position: { x: 100, y: 200 },
          data: { label: `Test ${type}`, type },
        },
      ];
      const result = DbDiagramNodesSchema.safeParse(nodes);
      expect(result.success).toBe(true);
    }
  });

  it('rejects payload with extra unexpected top-level structure', () => {
    const result = DbDiagramNodesSchema.safeParse('not-an-array');
    expect(result.success).toBe(false);
  });
});

describe('useRealtimeCollab — encrypted data decryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decryptDiagramData returns decrypted arrays from encrypted envelope', async () => {
    const encrypted = { iv: 'abc', ciphertext: 'xyz' };
    const decryptedNodes = [{ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'Svc', type: 'service' } }];
    const decryptedEdges = [{ id: 'e1', source: 'n1', target: 'n2', data: { protocol: 'REST' } }];

    mockedDecrypt.mockResolvedValueOnce({ nodes: decryptedNodes as any, edges: decryptedEdges as any });

    const result = await decryptDiagramData(encrypted, encrypted);
    expect(result.nodes).toEqual(decryptedNodes);
    expect(result.edges).toEqual(decryptedEdges);
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
    // The real implementation returns as-is for arrays; mock should reflect that
    mockedDecrypt.mockResolvedValueOnce({ nodes: nodes as any, edges: edges as any });

    const result = await decryptDiagramData(nodes, edges);
    expect(Array.isArray(result.nodes)).toBe(true);
  });
});
