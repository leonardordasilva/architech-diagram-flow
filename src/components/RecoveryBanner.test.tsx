import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAutoSave = vi.fn();
const mockClearAutoSave = vi.fn();

vi.mock('@/hooks/useAutoSave', () => ({
  getAutoSave: (...args: unknown[]) => mockGetAutoSave(...args),
  clearAutoSave: (...args: unknown[]) => mockClearAutoSave(...args),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/schemas/diagramSchema', () => ({
  DbDiagramNodesSchema: {
    safeParse: (v: unknown) => ({ success: Array.isArray(v), data: v }),
  },
  DbDiagramEdgesSchema: {
    safeParse: (v: unknown) => ({ success: Array.isArray(v), data: v }),
  },
}));

import { useDiagramStore } from '@/store/diagramStore';
import RecoveryBanner, { triggerRecoveryBanner } from '@/components/RecoveryBanner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RECOVERY_FLAG_KEY = 'microflow_show_recovery';

const mockSavedData = {
  nodes: [{ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'A', type: 'service' } }],
  edges: [],
  title: 'Diagrama Recuperado',
  savedAt: new Date().toISOString(),
  version: '2' as const,
};

function renderBanner() {
  return render(React.createElement(RecoveryBanner));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RecoveryBanner — visibilidade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useDiagramStore.setState({ nodes: [], edges: [] });
  });

  it('não renderiza nada quando não há flag de recovery', async () => {
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await waitFor(() => {
      expect(screen.queryByText('recovery.title')).not.toBeInTheDocument();
    });
  });

  it('renderiza banner quando flag está definida e não há nodes no canvas', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    expect(await screen.findByText('recovery.title', { exact: false })).toBeInTheDocument();
  });

  it('não renderiza banner quando já há nodes no canvas (diagrama ativo)', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    useDiagramStore.setState({
      nodes: [{ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'A', type: 'service' } }],
    });
    renderBanner();
    await waitFor(() => {
      expect(screen.queryByText('recovery.title')).not.toBeInTheDocument();
    });
  });

  it('não renderiza banner quando getAutoSave retorna null', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(null);
    renderBanner();
    await waitFor(() => {
      expect(screen.queryByText('recovery.title')).not.toBeInTheDocument();
    });
  });

  it('remove flag do sessionStorage após verificar (independente do resultado)', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });
    expect(sessionStorage.getItem(RECOVERY_FLAG_KEY)).toBeNull();
  });
});

describe('RecoveryBanner — ação de restaurar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useDiagramStore.setState({ nodes: [], edges: [] });
  });

  it('carrega diagrama no store ao clicar em restaurar', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });

    fireEvent.click(screen.getByText('recovery.restore'));

    await waitFor(() => {
      expect(useDiagramStore.getState().nodes).toHaveLength(1);
      expect(useDiagramStore.getState().nodes[0].id).toBe('n1');
    });
  });

  it('define o nome do diagrama ao restaurar', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });

    fireEvent.click(screen.getByText('recovery.restore'));

    await waitFor(() => {
      expect(useDiagramStore.getState().diagramName).toBe('Diagrama Recuperado');
    });
  });

  it('oculta banner após restaurar', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });

    fireEvent.click(screen.getByText('recovery.restore'));

    await waitFor(() => {
      expect(screen.queryByText('recovery.title')).not.toBeInTheDocument();
    });
  });
});

describe('RecoveryBanner — ação de descartar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useDiagramStore.setState({ nodes: [], edges: [] });
  });

  it('chama clearAutoSave ao descartar', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });

    fireEvent.click(screen.getByText('recovery.discard'));

    expect(mockClearAutoSave).toHaveBeenCalledOnce();
  });

  it('oculta banner após descartar', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });

    fireEvent.click(screen.getByText('recovery.discard'));

    await waitFor(() => {
      expect(screen.queryByText('recovery.title')).not.toBeInTheDocument();
    });
  });

  it('não carrega diagrama no store ao descartar', async () => {
    sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    mockGetAutoSave.mockResolvedValue(mockSavedData);
    renderBanner();
    await screen.findByText('recovery.title', { exact: false });

    fireEvent.click(screen.getByText('recovery.discard'));

    await waitFor(() => {
      expect(useDiagramStore.getState().nodes).toHaveLength(0);
    });
  });
});

describe('triggerRecoveryBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('define a flag de recovery no sessionStorage', () => {
    triggerRecoveryBanner();
    expect(sessionStorage.getItem(RECOVERY_FLAG_KEY)).toBe('1');
  });

  it('pode ser chamada múltiplas vezes sem erro', () => {
    expect(() => {
      triggerRecoveryBanner();
      triggerRecoveryBanner();
    }).not.toThrow();
  });
});
