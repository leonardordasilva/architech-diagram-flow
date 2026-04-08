// PRD-v3 ITEM-3: Unit tests for shareService
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock cryptoService (pass-through) ───
vi.mock('@/services/cryptoService', () => ({
  encryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({ nodes, edges })),
  decryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
  })),
}));

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  for (const key of Object.keys(chain)) {
    if (typeof chain[key] === 'function' && !['maybeSingle', 'single'].includes(key)) {
      (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }
  }
  return chain;
}

let mockFromChain = chainable();
let mockRpcResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockFromChain),
    rpc: vi.fn(() => Promise.resolve(mockRpcResult)),
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import {
  searchUsersByEmail,
  findUserByEmail,
  shareDiagramWithUser,
  listDiagramShares,
  revokeShare,
  loadSharedWithMe,
} from './shareService';

describe('shareService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromChain = chainable();
    mockRpcResult = { data: null, error: null };
  });

  describe('searchUsersByEmail', () => {
    it('returns empty array for query shorter than 3 chars without network call', async () => {
      const result = await searchUsersByEmail('ab', 'user-1');
      expect(result).toEqual([]);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('returns results for valid query', async () => {
      mockRpcResult = { data: [{ id: 'u2', email: 'test@test.com' }], error: null };
      const result = await searchUsersByEmail('test@', 'user-1');
      expect(supabase.rpc).toHaveBeenCalledWith('search_users_by_email', {
        p_query: 'test@',
        p_exclude_user_id: 'user-1',
      });
      expect(result).toEqual([{ id: 'u2', email: 'test@test.com' }]);
    });
  });

  describe('findUserByEmail', () => {
    it('returns user when found', async () => {
      mockFromChain = chainable({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'u1', email: 'a@b.com' }, error: null }),
      });
      const result = await findUserByEmail('A@B.com');
      expect(result).toEqual({ id: 'u1', email: 'a@b.com' });
    });

    it('returns null when not found', async () => {
      mockFromChain = chainable({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      const result = await findUserByEmail('nobody@x.com');
      expect(result).toBeNull();
    });
  });

  describe('shareDiagramWithUser', () => {
    it('inserts share without error', async () => {
      mockFromChain = chainable();
      // insert chain ends implicitly (no single/maybeSingle needed)
      await expect(shareDiagramWithUser('diag-1', 'owner-1', 'user-2')).resolves.not.toThrow();
    });

    it('throws for duplicate (23505)', async () => {
      mockFromChain = chainable();
      // Override the chain to return error at the end
      const chain = chainable();
      // The insert().eq() chain resolves with error
      (chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } })
      );
      vi.mocked(supabase.from).mockReturnValue(chain as never);
      await expect(shareDiagramWithUser('diag-1', 'owner-1', 'user-2')).rejects.toThrow(
        'Este usuário já tem acesso a este diagrama.'
      );
    });
  });

  describe('listDiagramShares', () => {
    it('returns enriched shares with emails', async () => {
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        if (table === 'diagram_shares' || callCount === 1) {
          return chainable({
            order: vi.fn().mockResolvedValue({
              data: [{ id: 's1', diagram_id: 'd1', owner_id: 'o1', shared_with_id: 'u2', created_at: '2026-01-01' }],
              error: null,
            }),
          }) as never;
        }
        // profiles
        return chainable({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'u2', email: 'collab@test.com' }],
            error: null,
          }),
        }) as never;
      });

      const result = await listDiagramShares('d1');
      expect(result).toHaveLength(1);
      expect(result[0].shared_with_email).toBe('collab@test.com');
    });
  });

  describe('revokeShare', () => {
    it('executes delete without error', async () => {
      const chain = chainable();
      (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);
      await expect(revokeShare('share-1')).resolves.not.toThrow();
    });
  });

  describe('loadSharedWithMe', () => {
    it('returns decrypted and validated diagrams', async () => {
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // diagram_shares
          return chainable({
            eq: vi.fn().mockResolvedValue({
              data: [{ diagram_id: 'd1', owner_id: 'o1' }],
              error: null,
            }),
          }) as never;
        }
        if (callCount === 2) {
          // diagrams
          return chainable({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'd1', title: 'Shared Diagram', updated_at: '2026-01-01', nodes: [], edges: [], owner_id: 'o1' }],
              error: null,
            }),
          }) as never;
        }
        // profiles
        return chainable({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'o1', email: 'owner@test.com' }],
            error: null,
          }),
        }) as never;
      });

      const result = await loadSharedWithMe('user-2');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Shared Diagram');
      expect(result[0].owner_email).toBe('owner@test.com');
    });
  });
});
