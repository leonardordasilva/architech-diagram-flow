import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => {
    if (opts && typeof opts === 'object') {
      return k + ':' + JSON.stringify(opts);
    }
    return k;
  }}),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { toast } from '@/hooks/use-toast';

const mockSearchUsers = vi.fn();
const mockShareWithUser = vi.fn();
const mockListShares = vi.fn();
const mockRevokeShare = vi.fn();

vi.mock('@/services/shareService', () => ({
  searchUsersByEmail: (...args: unknown[]) => mockSearchUsers(...args),
  shareDiagramWithUser: (...args: unknown[]) => mockShareWithUser(...args),
  listDiagramShares: (...args: unknown[]) => mockListShares(...args),
  revokeShare: (...args: unknown[]) => mockRevokeShare(...args),
}));

const mockShareDiagram = vi.fn();
vi.mock('@/services/diagramService', () => ({
  shareDiagram: (...args: unknown[]) => mockShareDiagram(...args),
}));

import ShareDiagramModal from '@/components/ShareDiagramModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  diagramId: 'diag-1',
  ownerId: 'owner-1',
};

function renderModal(props: Partial<React.ComponentProps<typeof ShareDiagramModal>> = {}) {
  return render(React.createElement(ShareDiagramModal, { ...defaultProps, ...props }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ShareDiagramModal — renderização', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListShares.mockResolvedValue([]);
  });

  it('renderiza título e seção de link público', async () => {
    renderModal();
    expect(await screen.findByText('shareDiagramModal.title')).toBeInTheDocument();
    expect(screen.getByText('shareDiagramModal.publicLink')).toBeInTheDocument();
  });

  it('exibe botão de gerar link quando shareLink ainda não existe', async () => {
    renderModal();
    await screen.findByText('shareDiagramModal.title');
    expect(screen.getByText('shareDiagramModal.generateLink')).toBeInTheDocument();
  });

  it('exibe busca por e-mail quando emailSharingEnabled=true', async () => {
    renderModal({ emailSharingEnabled: true });
    await screen.findByText('shareDiagramModal.title');
    expect(screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder')).toBeInTheDocument();
  });

  it('exibe tela de lock quando emailSharingEnabled=false', async () => {
    renderModal({ emailSharingEnabled: false });
    await screen.findByText('shareDiagramModal.emailSharingLocked');
    expect(screen.queryByPlaceholderText('shareDiagramModal.searchPlaceholder')).not.toBeInTheDocument();
  });

  it('não renderiza quando open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('shareDiagramModal.title')).not.toBeInTheDocument();
  });
});

describe('ShareDiagramModal — gerar link público', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListShares.mockResolvedValue([]);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('chama shareDiagram ao clicar em gerar link', async () => {
    mockShareDiagram.mockResolvedValue('https://app.example.com/diagram/abc123');
    renderModal();
    await screen.findByText('shareDiagramModal.generateLink');
    fireEvent.click(screen.getByText('shareDiagramModal.generateLink'));
    await waitFor(() => expect(mockShareDiagram).toHaveBeenCalledWith('diag-1'));
  });

  it('exibe input com URL após gerar link', async () => {
    mockShareDiagram.mockResolvedValue('https://app.example.com/diagram/abc123');
    renderModal();
    await screen.findByText('shareDiagramModal.generateLink');
    fireEvent.click(screen.getByText('shareDiagramModal.generateLink'));
    await waitFor(() => {
      const input = screen.getByDisplayValue('https://app.example.com/diagram/abc123');
      expect(input).toBeInTheDocument();
    });
  });

  it('copia URL para clipboard e exibe toast de sucesso', async () => {
    mockShareDiagram.mockResolvedValue('https://app.example.com/diagram/abc123');
    renderModal();
    await screen.findByText('shareDiagramModal.generateLink');
    fireEvent.click(screen.getByText('shareDiagramModal.generateLink'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'shareDiagramModal.linkCopied' }),
    ));
  });

  it('exibe toast de erro quando shareDiagram retorna null', async () => {
    mockShareDiagram.mockResolvedValue(null);
    renderModal();
    await screen.findByText('shareDiagramModal.generateLink');
    fireEvent.click(screen.getByText('shareDiagramModal.generateLink'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'shareDiagramModal.linkError' }),
    ));
  });
});

describe('ShareDiagramModal — copiar link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListShares.mockResolvedValue([]);
  });

  it('exibe toast de erro quando clipboard falha ao copiar', async () => {
    // First call (generate link) succeeds; second call (copy button) rejects
    const writeText = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    mockShareDiagram.mockResolvedValue('https://app.example.com/diagram/abc123');

    renderModal();
    await screen.findByText('shareDiagramModal.generateLink');

    // Generate link — first clipboard call succeeds
    fireEvent.click(screen.getByText('shareDiagramModal.generateLink'));
    await waitFor(() => expect(screen.getByDisplayValue('https://app.example.com/diagram/abc123')).toBeInTheDocument());

    // Clear toasts from generate-link step
    vi.mocked(toast).mockClear();

    // Click copy — second clipboard call rejects
    fireEvent.click(screen.getByRole('button', { name: 'shareDiagramModal.copyLink' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    ));
  });
});

describe('ShareDiagramModal — busca de usuários', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockListShares.mockResolvedValue([]);
    mockSearchUsers.mockResolvedValue([]);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('não dispara busca com query curta sem @', async () => {
    renderModal();
    const input = screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'ab' } });
    await vi.advanceTimersByTimeAsync(400);
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('dispara busca com query contendo @', async () => {
    mockSearchUsers.mockResolvedValue([{ id: 'u1', email: 'user@test.com' }]);
    renderModal();
    const input = screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'user@' } });
    await vi.advanceTimersByTimeAsync(400);
    await act(async () => { await Promise.resolve(); });
    expect(mockSearchUsers).toHaveBeenCalledWith('user@', 'owner-1');
  });

  it('exibe resultado de busca após pesquisa', async () => {
    mockSearchUsers.mockResolvedValue([{ id: 'u1', email: 'collab@test.com' }]);
    vi.useRealTimers();
    renderModal();
    const input = screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'collab@test.com' } });
    await waitFor(() => expect(screen.getByText('collab@test.com')).toBeInTheDocument(), { timeout: 1000 });
  });
});

describe('ShareDiagramModal — compartilhar usuários selecionados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListShares.mockResolvedValue([]);
    mockShareWithUser.mockResolvedValue(undefined);
    mockSearchUsers.mockResolvedValue([{ id: 'u1', email: 'collab@test.com' }]);
  });

  it('exibe toast de sucesso após compartilhar', async () => {
    renderModal();
    const input = screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'collab@test.com' } });
    await waitFor(() => expect(screen.getByText('collab@test.com')).toBeInTheDocument());

    // Check the user
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Share button appears
    await waitFor(() => expect(screen.getByText(/shareDiagramModal.shareWith/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/shareDiagramModal.shareWith/));

    await waitFor(() => expect(mockShareWithUser).toHaveBeenCalledWith('diag-1', 'owner-1', 'u1'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('shareDiagramModal.shareSuccess') }),
    ));
  });

  it('exibe toast de erro quando compartilhamento falha', async () => {
    mockShareWithUser.mockRejectedValue(new Error('forbidden'));
    renderModal();
    const input = screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'collab@test.com' } });
    await waitFor(() => expect(screen.getByText('collab@test.com')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByText(/shareDiagramModal.shareWith/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/shareDiagramModal.shareWith/));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: expect.stringContaining('shareDiagramModal.shareErrors') }),
    ));
  });

  it('bloqueia compartilhamento quando limite de colaboradores é atingido', async () => {
    mockListShares.mockResolvedValue([
      { id: 's1', shared_with_id: 'u99', shared_with_email: 'existing@test.com' },
    ]);
    renderModal({ maxCollaborators: 1 });
    const input = screen.getByPlaceholderText('shareDiagramModal.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'collab@test.com' } });
    await waitFor(() => expect(screen.getByText('collab@test.com')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByText(/shareDiagramModal.shareWith/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/shareDiagramModal.shareWith/));

    expect(mockShareWithUser).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });
});

describe('ShareDiagramModal — revogar acesso', () => {
  const existingShare = {
    id: 'share-1',
    shared_with_id: 'u2',
    shared_with_email: 'collab@test.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockListShares.mockResolvedValue([existingShare]);
    mockRevokeShare.mockResolvedValue(undefined);
  });

  it('exibe usuário com acesso existente', async () => {
    renderModal();
    expect(await screen.findByText('collab@test.com')).toBeInTheDocument();
  });

  it('remove usuário da lista após revogar', async () => {
    renderModal();
    await screen.findByText('collab@test.com');
    const revokeBtn = screen.getByRole('button', { name: 'shareDiagramModal.revokeAccess' });
    fireEvent.click(revokeBtn);
    await waitFor(() => expect(screen.queryByText('collab@test.com')).not.toBeInTheDocument());
  });

  it('exibe toast de sucesso após revogar', async () => {
    renderModal();
    await screen.findByText('collab@test.com');
    fireEvent.click(screen.getByRole('button', { name: 'shareDiagramModal.revokeAccess' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'shareDiagramModal.revokeSuccess' }),
    ));
  });

  it('exibe toast de erro quando revogação falha', async () => {
    mockRevokeShare.mockRejectedValue(new Error('network'));
    renderModal();
    await screen.findByText('collab@test.com');
    fireEvent.click(screen.getByRole('button', { name: 'shareDiagramModal.revokeAccess' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'shareDiagramModal.revokeError' }),
    ));
  });
});

describe('ShareDiagramModal — upgrade CTA (emailSharingEnabled=false)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListShares.mockResolvedValue([]);
  });

  it('chama onUpgradeRequest ao clicar em ver planos', async () => {
    const onUpgradeRequest = vi.fn();
    renderModal({ emailSharingEnabled: false, onUpgradeRequest });
    await screen.findByText('upgrade.seeProPlans');
    fireEvent.click(screen.getByText('upgrade.seeProPlans'));
    expect(onUpgradeRequest).toHaveBeenCalled();
  });
});
