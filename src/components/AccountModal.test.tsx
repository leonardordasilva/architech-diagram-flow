import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: string) => fallback ?? k,
    i18n: { language: 'pt-BR', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { toast } from '@/hooks/use-toast';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const mockSignOut = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'tok' },
    signOut: mockSignOut,
  }),
}));

vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false }) }));

const mockSupabaseFrom = vi.fn();
const mockAuthUpdateUser = vi.fn();
const mockAuthGetSession = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => mockAuthUpdateUser(...args),
      getSession: (...args: unknown[]) => mockAuthGetSession(...args),
      signOut: vi.fn(),
    },
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockStorageUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockStorageGetPublicUrl(...args),
      }),
    },
  },
}));

vi.mock('@/utils/getErrorMessage', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import { useDiagramStore } from '@/store/diagramStore';
import AccountModal from '@/components/AccountModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof AccountModal>> = {}) {
  return render(
    React.createElement(AccountModal, { open: true, onOpenChange: vi.fn(), ...props }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AccountModal — renderização', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // profiles fetch on open
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    });
    useDiagramStore.setState({ isDirty: false, nodes: [], edges: [] });
  });

  it('renderiza título da conta', async () => {
    renderModal();
    expect(await screen.findByText('account.title')).toBeInTheDocument();
  });

  it('exibe e-mail do usuário', async () => {
    renderModal();
    expect(await screen.findByText('test@test.com')).toBeInTheDocument();
  });

  it('exibe botão de trocar avatar com aria-busy=false por padrão', async () => {
    renderModal();
    const btn = await screen.findByRole('button', { name: 'account.changeAvatar' });
    expect(btn).toHaveAttribute('aria-busy', 'false');
  });

  it('exibe botão de sign out', async () => {
    renderModal();
    expect(await screen.findByText('account.signOut')).toBeInTheDocument();
  });

  it('exibe botão de redefinir senha', async () => {
    renderModal();
    expect(await screen.findByText('account.resetPassword')).toBeInTheDocument();
  });

  it('não renderiza quando open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('account.title')).not.toBeInTheDocument();
  });
});

describe('AccountModal — formulário de senha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    useDiagramStore.setState({ isDirty: false, nodes: [], edges: [] });
  });

  it('exibe formulário ao clicar em resetPassword', async () => {
    renderModal();
    fireEvent.click(await screen.findByText('account.resetPassword'));
    expect(screen.getByLabelText('resetPassword.newPassword')).toBeInTheDocument();
  });

  it('exibe toast de erro quando senhas não conferem', async () => {
    renderModal();
    fireEvent.click(await screen.findByText('account.resetPassword'));
    fireEvent.change(screen.getByLabelText('resetPassword.newPassword'), { target: { value: 'abc123' } });
    fireEvent.change(screen.getByLabelText('resetPassword.confirmPassword'), { target: { value: 'different' } });
    fireEvent.click(screen.getByText('resetPassword.submit'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'resetPassword.passwordMismatch' }),
    );
  });

  it('exibe toast de erro quando senha tem menos de 6 caracteres', async () => {
    renderModal();
    fireEvent.click(await screen.findByText('account.resetPassword'));
    fireEvent.change(screen.getByLabelText('resetPassword.newPassword'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('resetPassword.confirmPassword'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('resetPassword.submit'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'resetPassword.passwordTooShort' }),
    );
  });

  it('chama supabase.auth.updateUser com senha válida', async () => {
    mockAuthUpdateUser.mockResolvedValue({ error: null });
    renderModal();
    fireEvent.click(await screen.findByText('account.resetPassword'));
    fireEvent.change(screen.getByLabelText('resetPassword.newPassword'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('resetPassword.confirmPassword'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByText('resetPassword.submit'));
    await waitFor(() => expect(mockAuthUpdateUser).toHaveBeenCalledWith({ password: 'newpass123' }));
  });

  it('exibe toast de sucesso após troca de senha bem-sucedida', async () => {
    mockAuthUpdateUser.mockResolvedValue({ error: null });
    renderModal();
    fireEvent.click(await screen.findByText('account.resetPassword'));
    fireEvent.change(screen.getByLabelText('resetPassword.newPassword'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('resetPassword.confirmPassword'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByText('resetPassword.submit'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'resetPassword.success' }),
    ));
  });

  it('submit tem aria-busy=false por padrão', async () => {
    renderModal();
    fireEvent.click(await screen.findByText('account.resetPassword'));
    const submitBtn = screen.getByText('resetPassword.submit').closest('button')!;
    expect(submitBtn).toHaveAttribute('aria-busy', 'false');
  });
});

describe('AccountModal — avatar: validação de arquivo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    useDiagramStore.setState({ isDirty: false, nodes: [], edges: [] });
  });

  it('exibe toast de erro para tipo de arquivo inválido', async () => {
    renderModal();
    await screen.findByText('account.title');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'account.avatarInvalidType' }),
    );
  });

  it('exibe toast de erro para arquivo maior que 2 MB', async () => {
    renderModal();
    await screen.findByText('account.title');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const content = 'x'.repeat(2 * 1024 * 1024 + 1);
    const file = new File([content], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: content.length });
    fireEvent.change(input, { target: { files: [file] } });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'account.avatarTooLarge' }),
    );
  });
});

describe('AccountModal — sign out com alterações não salvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('exibe dialog de confirmação quando há alterações não salvas', async () => {
    useDiagramStore.setState({ isDirty: true, nodes: [], edges: [] });
    renderModal();
    fireEvent.click(await screen.findByText('account.signOut'));
    expect(await screen.findByText('Alterações não salvas')).toBeInTheDocument();
  });

  it('chama signOut diretamente quando não há alterações', async () => {
    useDiagramStore.setState({ isDirty: false, nodes: [], edges: [] });
    mockSignOut.mockResolvedValue(undefined);
    renderModal();
    fireEvent.click(await screen.findByText('account.signOut'));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledOnce());
  });
});
