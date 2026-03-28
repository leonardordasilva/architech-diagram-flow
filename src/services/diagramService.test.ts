import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock cryptoService (pass-through for tests) ───
vi.mock('@/services/cryptoService', () => ({
  encryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({
    nodes: { iv: 'mock-iv', ciphertext: 'mock-ct' },
    edges: { iv: 'mock-iv', ciphertext: 'mock-ct' },
  })),
  decryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
  })),
}));
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

function chainable(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  // make each method return chain
  for (const key of Object.keys(chain)) {
    if (typeof chain[key] === 'function' && key !== 'single') {
      (chain[key] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    }
  }
  return chain;
}

vi.mock('@/integrations/supabase/client', () => {
  const chain = chainable();
  return {
    supabase: {
      from: vi.fn(() => chain),
      functions: { invoke: vi.fn() },
      rpc: vi.fn(),
    },
    __chain: chain,
  };
});

import { supabase } from '@/integrations/supabase/client';
import {
  saveDiagram,
  saveSharedDiagram,
  loadDiagramById,
  deleteDiagram,
  renameDiagram,
} from './diagramService';

const mockRow = {
  id: 'diag-1',
  title: 'Test Diagram',
  nodes: [],
  edges: [],
  owner_id: 'user-1',
  share_token: null,
  is_shared: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('diagramService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain for each test
    const chain = (supabase as unknown as { __chain: ReturnType<typeof chainable> }).__chain;
    // We need to re-setup for each test
  });

  describe('saveDiagram', () => {
    it('without existingId calls insert and returns DiagramRecord', async () => {
      const chain = chainable({
        single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await saveDiagram('Test', [], [], 'user-1');
      expect(supabase.from).toHaveBeenCalledWith('diagrams');
      expect(chain.insert).toHaveBeenCalled();
      expect(result.id).toBe('diag-1');
      expect(result.title).toBe('Test Diagram');
    });

    it('with existingId calls update with owner_id eq and returns DiagramRecord', async () => {
      const chain = chainable({
        single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await saveDiagram('Test', [], [], 'user-1', 'diag-1');
      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'diag-1');
      expect(chain.eq).toHaveBeenCalledWith('owner_id', 'user-1');
      expect(result.id).toBe('diag-1');
    });

    it('throws when Supabase returns error', async () => {
      const chain = chainable({
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(saveDiagram('Test', [], [], 'user-1')).rejects.toThrow();
    });
  });

  describe('saveSharedDiagram', () => {
    it('não filtra por owner_id — proteção delegada ao RLS (contrato de segurança)', async () => {
      const chain = chainable();
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(
        saveSharedDiagram('diag-1', [], [])
      ).resolves.not.toThrow();

      const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
      const ownerIdCall = eqCalls.find((args: unknown[]) => args[0] === 'owner_id');
      expect(ownerIdCall).toBeUndefined();
    });
  });

  describe('loadDiagramById', () => {
    it('returns DiagramRecord for a valid row', async () => {
      const chain = chainable({
        single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await loadDiagramById('diag-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('diag-1');
      expect(result!.title).toBe('Test Diagram');
      expect(result!.nodes).toEqual([]);
      expect(result!.edges).toEqual([]);
    });

    it('returns null when Supabase returns error', async () => {
      const chain = chainable({
        single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await loadDiagramById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteDiagram', () => {
    it('R9: performs soft delete (update deleted_at) instead of hard delete', async () => {
      const chain = chainable();
      let eqCount = 0;
      (chain.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
        eqCount++;
        if (eqCount >= 2) return Promise.resolve({ error: null });
        return chain;
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await deleteDiagram('diag-1', 'user-1');
      expect(supabase.from).toHaveBeenCalledWith('diagrams');
      // R9: must use update (soft delete), NOT delete
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ deleted_at: expect.any(String) }),
      );
      expect(chain.delete).not.toHaveBeenCalled();
    });
  });

  describe('renameDiagram', () => {
    it('throws error for empty title without calling Supabase', async () => {
      await expect(renameDiagram('diag-1', '', 'user-1')).rejects.toThrow(
        'Título inválido: deve ter entre 1 e 100 caracteres'
      );
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('throws error for title with 101 characters', async () => {
      const longTitle = 'a'.repeat(101);
      await expect(renameDiagram('diag-1', longTitle, 'user-1')).rejects.toThrow(
        'Título inválido: deve ter entre 1 e 100 caracteres'
      );
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('calls update correctly for valid title', async () => {
      const chain = chainable();
      let eqCount = 0;
      (chain.eq as ReturnType<typeof vi.fn>).mockImplementation(() => {
        eqCount++;
        if (eqCount >= 2) return Promise.resolve({ error: null });
        return chain;
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await renameDiagram('diag-1', 'New Title', 'user-1');
      expect(supabase.from).toHaveBeenCalledWith('diagrams');
      expect(chain.update).toHaveBeenCalled();
    });
  });
});
