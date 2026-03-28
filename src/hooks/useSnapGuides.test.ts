import { describe, it, expect } from 'vitest';
import { computeSnap } from './useSnapGuides';
import type { Node } from '@xyflow/react';

function createNode(id: string, x: number, y: number, w = 160, h = 80): Node {
  return {
    id,
    type: 'service',
    position: { x, y },
    data: {},
    measured: { width: w, height: h },
  } as Node;
}

describe('computeSnap', () => {
  it('retorna null quando não há nós para alinhar', () => {
    const dragged = createNode('d', 100, 100);
    const result = computeSnap(dragged, [dragged]);
    expect(result.snapX).toBeNull();
    expect(result.snapY).toBeNull();
    expect(result.guides).toHaveLength(0);
  });

  it('snapa no centro X quando nós estão próximos', () => {
    const dragged = createNode('d', 102, 200);
    const target = createNode('t', 100, 50);
    const result = computeSnap(dragged, [dragged, target]);
    // Centro X do target = 100 + 80 = 180; centro X do dragged = 102 + 80 = 182
    // Diferença = 2 < threshold (8) → snap
    expect(result.snapX).not.toBeNull();
  });

  it('snapa no centro Y quando nós estão próximos', () => {
    const dragged = createNode('d', 300, 53);
    const target = createNode('t', 50, 50);
    const result = computeSnap(dragged, [dragged, target]);
    // Centro Y target = 50 + 40 = 90; centro Y dragged = 53 + 40 = 93
    // Diferença = 3 < threshold → snap
    expect(result.snapY).not.toBeNull();
  });

  it('não snapa quando nós estão distantes', () => {
    const dragged = createNode('d', 500, 500);
    const target = createNode('t', 0, 0);
    const result = computeSnap(dragged, [dragged, target]);
    expect(result.snapX).toBeNull();
    expect(result.snapY).toBeNull();
  });

  it('gera guide lines quando snap é detectado', () => {
    const dragged = createNode('d', 100, 100);
    const target = createNode('t', 100, 250);
    const result = computeSnap(dragged, [dragged, target]);
    // Borda esquerda alinhada perfeitamente → deve gerar guide
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('snapa na borda esquerda de outro nó', () => {
    const dragged = createNode('d', 103, 200);
    const target = createNode('t', 100, 50);
    const result = computeSnap(dragged, [dragged, target]);
    // Borda esquerda target = 100; borda esquerda dragged = 103; diff = 3 < 8
    expect(result.snapX).not.toBeNull();
  });
});
