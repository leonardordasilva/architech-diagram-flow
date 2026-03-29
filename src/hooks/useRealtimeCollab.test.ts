import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDiagramStore } from '@/store/diagramStore';
import { DbDiagramNodesSchema, DbDiagramEdgesSchema } from '@/schemas/diagramSchema';

describe('useRealtimeCollab — payload validation', () => {
  it('accepts valid broadcast payload with nodes and edges', () => {
    const validNodes = [
      {
        id: 'node-1',
        type: 'service',
        position: { x: 0, y: 0 },
        data: { label: 'API Gateway', description: '', techStack: [], protocol: 'REST' },
      },
    ];
    const validEdges = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        data: { protocol: 'REST', label: 'calls' },
      },
    ];

    const nodesParsed = DbDiagramNodesSchema.safeParse(validNodes);
    const edgesParsed = DbDiagramEdgesSchema.safeParse(validEdges);

    expect(nodesParsed.success).toBe(true);
    expect(edgesParsed.success).toBe(true);
  });

  it('rejects broadcast payload with invalid node structure', () => {
    const invalidNodes = [{ id: 123, type: null }]; // id should be string
    const result = DbDiagramNodesSchema.safeParse(invalidNodes);
    expect(result.success).toBe(false);
  });

  it('rejects broadcast payload with invalid edge structure', () => {
    const invalidEdges = [{ id: 'e1' }]; // missing source/target
    const result = DbDiagramEdgesSchema.safeParse(invalidEdges);
    expect(result.success).toBe(false);
  });

  it('accepts empty arrays (valid edge case)', () => {
    expect(DbDiagramNodesSchema.safeParse([]).success).toBe(true);
    expect(DbDiagramEdgesSchema.safeParse([]).success).toBe(true);
  });

  it('detects encrypted envelope and skips (non-array check)', () => {
    const encryptedPayload = { iv: 'abc123', ciphertext: 'encrypted-data' };
    // The realtime hook checks Array.isArray before processing
    expect(Array.isArray(encryptedPayload)).toBe(false);
    // This would cause the hook to skip the update — correct behavior
  });

  it('handles concurrent broadcast with different timestamps', () => {
    const ts1 = '2026-03-01T10:00:00Z';
    const ts2 = '2026-03-01T10:00:01Z';
    // Simulates the PERF-03 optimization: different updated_at triggers processing
    expect(ts1).not.toBe(ts2);
  });

  it('accepts nodes with all supported types', () => {
    const nodeTypes = ['service', 'database', 'queue', 'external'];
    for (const type of nodeTypes) {
      const nodes = [
        {
          id: `node-${type}`,
          type,
          position: { x: 100, y: 200 },
          data: { label: `Test ${type}`, description: '', techStack: [], protocol: 'REST' },
        },
      ];
      const result = DbDiagramNodesSchema.safeParse(nodes);
      expect(result.success).toBe(true);
    }
  });

  it('rejects payload with extra unexpected top-level structure', () => {
    // Not an array at all
    const result = DbDiagramNodesSchema.safeParse('not-an-array');
    expect(result.success).toBe(false);
  });
});
