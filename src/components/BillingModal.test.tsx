import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Supabase mock ────────────────────────────────────────────────────────────
const mockFetchSub = vi.fn();
const mockRpc = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: (...args: unknown[]) => mockFetchSub(...args),
    })),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}));

// ─── Auth mock ────────────────────────────────────────────────────────────────
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    session: { access_token: 'tok' },
  }),
}));

// ─── i18n mock ────────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}));

// ─── Toast mock ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { toast } from '@/hooks/use-toast';

// ─── UpgradeModal stub ────────────────────────────────────────────────────────
vi.mock('@/components/UpgradeModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? React.createElement('div', { 'data-testid': 'upgrade-modal' }) : null,
}));

// ─── planLimits mock (mutable via module-level variable) ─────────────────────
let mockPlan = 'free';
vi.mock('@/hooks/usePlanLimits', () => ({
  usePlanLimits: () => ({
    plan: mockPlan,
    maxDiagrams: 3,
    maxNodesPerDiagram: 50,
    maxCollaboratorsPerDiagram: null,
    allowedExportFormats: ['png', 'json'],
    watermarkEnabled: true,
    realtimeCollabEnabled: false,
    emailSharingEnabled: false,
  }),
}));

import BillingModal from '@/components/BillingModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function renderBilling(props: Partial<React.ComponentProps<typeof BillingModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(BillingModal, { open: true, onOpenChange: vi.fn(), ...props }),
    ),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BillingModal — renderização por plano', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSub.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: 2, error: null });
    mockPlan = 'free';
  });

  it('exibe botão de upgrade quando plano é free', async () => {
    renderBilling();
    expect(await screen.findByText('billing.upgradePlan')).toBeInTheDocument();
  });

  it('não exibe botão de portal quando plano é free', async () => {
    renderBilling();
    await screen.findByText('billing.upgradePlan');
    expect(screen.queryByText('billing.manageSubscription')).not.toBeInTheDocument();
  });

  it('exibe botão de portal quando plano é pro', async () => {
    mockPlan = 'pro';
    mockFetchSub.mockResolvedValue({
      data: { plan: 'pro', status: 'active', billing_cycle: 'monthly', current_period_end: null },
      error: null,
    });
    renderBilling();
    expect(await screen.findByText('billing.manageSubscription')).toBeInTheDocument();
  });

  it('não está fechado por padrão — open=true renderiza conteúdo', async () => {
    renderBilling();
    expect(await screen.findByText('billing.title')).toBeInTheDocument();
  });

  it('não renderiza conteúdo quando open=false', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      React.createElement(
        QueryClientProvider,
        { client: qc },
        React.createElement(BillingModal, { open: false, onOpenChange: vi.fn() }),
      ),
    );
    expect(screen.queryByText('billing.title')).not.toBeInTheDocument();
  });
});

describe('BillingModal — checkout processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSub.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: 0, error: null });
    // Default: hang forever so checkoutProcessing is never cleared by side effects
    mockFunctionsInvoke.mockImplementation(() => new Promise(() => {}));
    mockPlan = 'free';
  });

  it('exibe indicador de processamento quando checkoutSuccess=true', () => {
    // checkoutProcessing is initialised synchronously from the prop — no await needed
    renderBilling({ checkoutSuccess: true });
    expect(screen.getByText('billing.checkoutProcessing')).toBeInTheDocument();
  });

  it('para de exibir processamento após verify-checkout retornar verified=true', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { verified: true }, error: null });

    renderBilling({ checkoutSuccess: true, sessionId: 'sess-123' });
    expect(screen.getByText('billing.checkoutProcessing')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('billing.checkoutProcessing')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('BillingModal — polling lógica de negócio', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('para polling após CHECKOUT_MAX_POLLS tentativas sem atualização', async () => {
    vi.useFakeTimers();
    const POLL_INTERVAL = 3_000;
    const MAX_POLLS = 10;
    const fetchSub = vi.fn().mockResolvedValue({ plan: 'free', status: 'inactive' });

    let attempts = 0;
    let stopped = false;
    const intervalId = setInterval(async () => {
      attempts++;
      try {
        const sub = await fetchSub();
        const updated = sub?.plan && sub.plan !== 'free' && sub.status === 'active';
        if (updated || attempts >= MAX_POLLS) { clearInterval(intervalId); stopped = true; }
      } catch {
        clearInterval(intervalId); stopped = true;
      }
    }, POLL_INTERVAL);

    for (let i = 0; i < MAX_POLLS; i++) {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
    }

    expect(fetchSub).toHaveBeenCalledTimes(MAX_POLLS);
    expect(stopped).toBe(true);
    vi.useRealTimers();
  });

  it('para polling e chama toast de erro quando fetchSubscription lança', async () => {
    vi.useFakeTimers();
    const POLL_INTERVAL = 3_000;
    const mockToast = vi.fn();
    const getErrorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Unknown error');
    const fetchSub = vi.fn().mockRejectedValue(new Error('network failure'));

    let stopped = false;
    const intervalId = setInterval(async () => {
      try {
        await fetchSub();
      } catch (err: unknown) {
        clearInterval(intervalId);
        stopped = true;
        mockToast({ title: 'billing.checkoutError', description: getErrorMessage(err), variant: 'destructive' });
      }
    }, POLL_INTERVAL);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(stopped).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'network failure' }),
    );
    vi.useRealTimers();
  });

  it('para polling imediatamente quando plano já está ativo', async () => {
    vi.useFakeTimers();
    const POLL_INTERVAL = 3_000;
    const fetchSub = vi.fn().mockResolvedValue({ plan: 'pro', status: 'active' });

    let attempts = 0;
    let stopped = false;
    const intervalId = setInterval(async () => {
      attempts++;
      const sub = await fetchSub();
      const updated = sub?.plan && sub.plan !== 'free' && sub.status === 'active';
      if (updated) { clearInterval(intervalId); stopped = true; }
    }, POLL_INTERVAL);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL);

    expect(attempts).toBe(1);
    expect(stopped).toBe(true);
    vi.useRealTimers();
  });
});

describe('BillingModal — aria-busy no botão de portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSub.mockResolvedValue({
      data: { plan: 'pro', status: 'active', billing_cycle: 'monthly', current_period_end: null },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: 1, error: null });
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'portal error' } });
    mockPlan = 'pro';
  });

  it('botão de portal tem aria-busy=false por padrão', async () => {
    renderBilling();
    const btn = await screen.findByText('billing.manageSubscription');
    expect(btn.closest('button')).toHaveAttribute('aria-busy', 'false');
  });

  it('botão de portal tem aria-busy=true durante loading do portal', async () => {
    // Mock portal to hang indefinitely
    mockFunctionsInvoke.mockImplementation(
      () => new Promise(() => {}),
    );
    renderBilling();
    const btn = await screen.findByText('billing.manageSubscription');
    fireEvent.click(btn.closest('button')!);
    await waitFor(() => {
      expect(btn.closest('button')).toHaveAttribute('aria-busy', 'true');
    });
  });
});

describe('BillingModal — uso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSub.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: 2, error: null });
    mockPlan = 'free';
  });

  it('exibe contagem de diagramas na seção de uso', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null });
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });
  });

  it('chama onOpenChange(false) quando botão de upgrade abre upgrade modal e fecha billing', async () => {
    const onOpenChange = vi.fn();
    renderBilling({ onOpenChange });
    const upgradeBtn = await screen.findByText('billing.upgradePlan');
    fireEvent.click(upgradeBtn);
    expect(await screen.findByTestId('upgrade-modal')).toBeInTheDocument();
  });
});
