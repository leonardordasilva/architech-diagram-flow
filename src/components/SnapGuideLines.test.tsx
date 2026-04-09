import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock React Flow store so we don't need a ReactFlowProvider in tests
vi.mock('@xyflow/react', () => ({
  useStore: vi.fn((selector: (s: { transform: [number, number, number] }) => unknown) =>
    selector({ transform: [0, 0, 1] }),
  ),
  useReactFlow: vi.fn(() => ({})),
}));

import SnapGuideLines from '@/components/SnapGuideLines';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SnapGuideLines', () => {
  it('retorna null quando guides está vazio', () => {
    const { container } = render(React.createElement(SnapGuideLines, { guides: [] }));
    expect(container.firstChild).toBeNull();
  });

  it('renderiza SVG com aria-hidden quando há guides', () => {
    const { container } = render(
      React.createElement(SnapGuideLines, {
        guides: [{ type: 'vertical', pos: 100 }],
      }),
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renderiza line para guide vertical', () => {
    const { container } = render(
      React.createElement(SnapGuideLines, {
        guides: [{ type: 'vertical', pos: 100 }],
      }),
    );
    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    // pos * scale + tx = 100 * 1 + 0 = 100
    expect(line?.getAttribute('x1')).toBe('100');
  });

  it('renderiza line para guide horizontal', () => {
    const { container } = render(
      React.createElement(SnapGuideLines, {
        guides: [{ type: 'horizontal', pos: 200 }],
      }),
    );
    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    // pos * scale + ty = 200 * 1 + 0 = 200
    expect(line?.getAttribute('y1')).toBe('200');
  });

  it('renderiza múltiplas lines para múltiplas guides', () => {
    const { container } = render(
      React.createElement(SnapGuideLines, {
        guides: [
          { type: 'vertical', pos: 50 },
          { type: 'horizontal', pos: 75 },
          { type: 'vertical', pos: 150 },
        ],
      }),
    );
    const lines = container.querySelectorAll('line');
    expect(lines).toHaveLength(3);
  });

  it('aplica transform de escala e translação corretos', async () => {
    const xyflow = await import('@xyflow/react') as unknown as {
      useStore: ReturnType<typeof vi.fn>;
    };
    xyflow.useStore.mockImplementation((selector: (s: { transform: [number, number, number] }) => unknown) =>
      selector({ transform: [10, 20, 2] }),
    );
    const { container } = render(
      React.createElement(SnapGuideLines, {
        guides: [{ type: 'vertical', pos: 100 }],
      }),
    );
    const line = container.querySelector('line');
    // pos * scale + tx = 100 * 2 + 10 = 210
    expect(line?.getAttribute('x1')).toBe('210');
  });
});
