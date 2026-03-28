import { describe, it, expect } from 'vitest';
import { ImportDiagramSchema } from './diagramSchema';

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

describe('ImportDiagramSchema', () => {
  it('aceita JSON válido', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [validNode, { ...validNode, id: 'n2' }],
      edges: [validEdge],
    });
    expect(result.success).toBe(true);
  });

  it('rejeita nó sem id', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [{ ...validNode, id: '' }],
      edges: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejeita type inválido', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [{ ...validNode, type: 'lambda' }],
      edges: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejeita aresta sem source', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [validNode],
      edges: [{ ...validEdge, source: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejeita nodes vazio', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [],
      edges: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejeita protocolo desconhecido', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [validNode, { ...validNode, id: 'n2' }],
      edges: [{ ...validEdge, data: { protocol: 'SOAP' } }],
    });
    expect(result.success).toBe(false);
  });

  it('aceita edge sem data.protocol', () => {
    const result = ImportDiagramSchema.safeParse({
      nodes: [validNode, { ...validNode, id: 'n2' }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    });
    expect(result.success).toBe(true);
  });

  // Épico 1 — Normalização de internalDatabases/internalServices
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

  it('normaliza internalDatabases de formato {label} sem id para string', () => {
    const node = {
      ...validNode,
      data: {
        ...validNode.data,
        internalDatabases: [{ label: 'Redis Cache' }],
      },
    };
    const result = ImportDiagramSchema.parse({ nodes: [node], edges: [] });
    expect(result.nodes[0].data.internalDatabases).toEqual(['Redis Cache']);
  });
});
