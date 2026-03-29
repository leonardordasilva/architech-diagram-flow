import { describe, it, expect } from 'vitest';
import { NodeSchema, EdgeSchema, ImportDiagramSchema, DbDiagramNodesSchema, DbDiagramEdgesSchema } from './diagramSchema';

const validNode = {
  id: 'n1',
  type: 'service' as const,
  position: { x: 0, y: 0 },
  data: { label: 'API Gateway', type: 'service' as const },
};

const validEdge = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  data: { protocol: 'REST' as const },
};

describe('NodeSchema', () => {
  it('accepts a valid service node', () => {
    expect(NodeSchema.safeParse(validNode).success).toBe(true);
  });

  it('rejects node without id', () => {
    expect(NodeSchema.safeParse({ ...validNode, id: '' }).success).toBe(false);
  });

  it('rejects invalid node type', () => {
    expect(NodeSchema.safeParse({ ...validNode, type: 'invalid' }).success).toBe(false);
  });

  it('rejects label exceeding 100 chars', () => {
    const longLabel = { ...validNode, data: { ...validNode.data, label: 'a'.repeat(101) } };
    expect(NodeSchema.safeParse(longLabel).success).toBe(false);
  });

  it('accepts node with optional fields', () => {
    const withOptional = { ...validNode, data: { ...validNode.data, subType: 'REST', externalCategory: 'API' } };
    expect(NodeSchema.safeParse(withOptional).success).toBe(true);
  });

  it('passes through extra fields (passthrough)', () => {
    const withExtra = { ...validNode, selected: true, measured: { width: 180, height: 80 } };
    const result = NodeSchema.safeParse(withExtra);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveProperty('selected', true);
  });
});

describe('EdgeSchema', () => {
  it('accepts a valid edge', () => {
    expect(EdgeSchema.safeParse(validEdge).success).toBe(true);
  });

  it('rejects edge without source', () => {
    expect(EdgeSchema.safeParse({ ...validEdge, source: '' }).success).toBe(false);
  });

  it('accepts edge with protocol', () => {
    const withProtocol = { ...validEdge, data: { protocol: 'gRPC' } };
    expect(EdgeSchema.safeParse(withProtocol).success).toBe(true);
  });

  it('rejects invalid protocol', () => {
    const bad = { ...validEdge, data: { protocol: 'INVALID' } };
    expect(EdgeSchema.safeParse(bad).success).toBe(false);
  });
});

describe('ImportDiagramSchema', () => {
  it('requires at least one node', () => {
    expect(ImportDiagramSchema.safeParse({ nodes: [], edges: [] }).success).toBe(false);
  });

  it('accepts valid import', () => {
    const input = {
      nodes: [{ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'Svc', type: 'service' } }],
      edges: [],
      name: 'Test',
    };
    expect(ImportDiagramSchema.safeParse(input).success).toBe(true);
  });

  it('normaliza internalDatabases de formato objeto {id, label} para string', () => {
    const node = {
      ...validNode,
      data: {
        ...validNode.data,
        internalDatabases: [{ id: 'db1', label: 'Oracle Prod' }],
      },
    };
    const result = ImportDiagramSchema.parse({ nodes: [node], edges: [] });
    expect(result.nodes[0].data.internalDatabases).toEqual(['Oracle Prod']);
  });

  it('mantém internalDatabases string[] inalterado', () => {
    const node = {
      ...validNode,
      data: {
        ...validNode.data,
        internalDatabases: ['Oracle Prod'],
      },
    };
    const result = ImportDiagramSchema.parse({ nodes: [node], edges: [] });
    expect(result.nodes[0].data.internalDatabases).toEqual(['Oracle Prod']);
  });
});

describe('DbDiagramNodesSchema / DbDiagramEdgesSchema', () => {
  it('accepts empty arrays (no min constraint)', () => {
    expect(DbDiagramNodesSchema.safeParse([]).success).toBe(true);
    expect(DbDiagramEdgesSchema.safeParse([]).success).toBe(true);
  });
});
