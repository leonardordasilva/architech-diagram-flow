import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import DiagramContextMenu from '@/components/DiagramContextMenu';
import type { DiagramNode } from '@/types/diagram';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const contextMenu = { x: 100, y: 200, nodeId: 'n1', nodeLabel: 'My Service' };

const nodes: DiagramNode[] = [
  { id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'My Service', type: 'service' } },
];

function renderMenu(
  overrides: Partial<Parameters<typeof DiagramContextMenu>[0]> = {},
  onSpawn = vi.fn(),
  onClose = vi.fn(),
) {
  return render(
    React.createElement(DiagramContextMenu, {
      contextMenu,
      nodes,
      onSpawn,
      onClose,
      ...overrides,
    }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DiagramContextMenu — renderização', () => {
  it('renderiza container com role=menu', () => {
    renderMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renderiza botão com role=menuitem', () => {
    renderMenu();
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
  });

  it('exibe rótulo da ação createFrom', () => {
    renderMenu();
    expect(screen.getByText('contextMenu.createFrom')).toBeInTheDocument();
  });

  it('posiciona menu nas coordenadas corretas', () => {
    renderMenu();
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ top: '200px', left: '100px' });
  });
});

describe('DiagramContextMenu — interações', () => {
  it('chama onSpawn com dados do nó ao clicar', () => {
    const onSpawn = vi.fn();
    const onClose = vi.fn();
    renderMenu({}, onSpawn, onClose);
    fireEvent.click(screen.getByRole('menuitem'));
    expect(onSpawn).toHaveBeenCalledWith({
      id: 'n1',
      label: 'My Service',
      nodeType: 'service',
    });
  });

  it('chama onClose ao clicar', () => {
    const onClose = vi.fn();
    renderMenu({}, vi.fn(), onClose);
    fireEvent.click(screen.getByRole('menuitem'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('passa nodeType vazio quando nó não é encontrado', () => {
    const onSpawn = vi.fn();
    renderMenu({ contextMenu: { ...contextMenu, nodeId: 'nonexistent' } }, onSpawn);
    fireEvent.click(screen.getByRole('menuitem'));
    expect(onSpawn).toHaveBeenCalledWith(expect.objectContaining({ nodeType: '' }));
  });
});
