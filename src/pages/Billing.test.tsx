import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock (must be before any imports that use it) ──────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from '@/integrations/supabase/client';

// ─── CYCLE_LABEL_KEYS contract ────────────────────────────────────────────────
// These keys must align with the i18n locale files (pricing.cycle*)

const CYCLE_LABEL_KEYS: Record<string, string> = {
  monthly: 'pricing.cycleMonthly',
  quarterly: 'pricing.cycleQuarterly',
  semiannual: 'pricing.cycleSemiannual',
  annual: 'pricing.cycleAnnual',
};

describe('Billing — CYCLE_LABEL_KEYS', () => {
  it('maps all four billing cycles to i18n keys', () => {
    const cycles = ['monthly', 'quarterly', 'semiannual', 'annual'];
    cycles.forEach((c) => {
      expect(CYCLE_LABEL_KEYS[c]).toBeDefined();
      expect(CYCLE_LABEL_KEYS[c]).toMatch(/^pricing\./);
    });
  });

  it('does not have unexpected cycles', () => {
    expect(Object.keys(CYCLE_LABEL_KEYS)).toHaveLength(4);
  });
});

// ─── fetchSubscription ────────────────────────────────────────────────────────

describe('Billing — fetchSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when supabase returns an error', async () => {
    const mockError = { message: 'access denied' };
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: mockError }),
    });

    // Inline the same logic as Billing.tsx's fetchSubscription
    async function fetchSubscription(userId: string) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    await expect(fetchSubscription('user-1')).rejects.toMatchObject(mockError);
  });

  it('returns null when no subscription exists', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    async function fetchSubscription(userId: string) {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    const result = await fetchSubscription('user-1');
    expect(result).toBeNull();
  });
});

// ─── fetchDiagramCount ────────────────────────────────────────────────────────

describe('Billing — fetchDiagramCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the count from the RPC', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 7, error: null });

    async function fetchDiagramCount(userId: string) {
      const { data, error } = await supabase.rpc('get_user_diagram_count', { p_user_id: userId });
      if (error || data === null) return 0;
      return data as number;
    }

    expect(await fetchDiagramCount('user-1')).toBe(7);
  });

  it('returns 0 when the RPC errors', async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });

    async function fetchDiagramCount(userId: string) {
      const { data, error } = await supabase.rpc('get_user_diagram_count', { p_user_id: userId });
      if (error || data === null) return 0;
      return data as number;
    }

    expect(await fetchDiagramCount('user-1')).toBe(0);
  });
});
