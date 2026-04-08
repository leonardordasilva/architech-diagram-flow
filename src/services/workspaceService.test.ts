// PRD-v3 ITEM-3: Unit tests for workspaceService
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Creates a chainable mock where every method returns `this` except terminal ones */
function chainable(terminal: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'update', 'delete', 'insert', 'eq', 'is', 'in', 'order'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Apply terminal overrides — these are pre-configured mock fns
  for (const [key, fn] of Object.entries(terminal)) {
    chain[key] = fn;
  }
  return chain;
}

/** Creates chain where last eq resolves with data after N eq calls */
function chainWithTerminalEq(eqCount: number, result: unknown) {
  let calls = 0;
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'update', 'delete', 'insert', 'is', 'in', 'order'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.eq = vi.fn().mockImplementation(() => {
    calls++;
    if (calls >= eqCount) return Promise.resolve(result);
    return chain;
  });
  return chain;
}

let mockRpcResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(() => Promise.resolve(mockRpcResult)),
    functions: { invoke: vi.fn() },
  },
}));

import { supabase } from '@/integrations/supabase/client';
import {
  getMyWorkspace,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
  renameWorkspace,
  loadWorkspaceDiagrams,
} from './workspaceService';

describe('workspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcResult = { data: null, error: null };
  });

  describe('getMyWorkspace', () => {
    it('returns mapped WorkspaceRecord', async () => {
      mockRpcResult = {
        data: [{ id: 'ws-1', name: 'Team', owner_id: 'u1', role: 'owner', stripe_subscription_id: null, created_at: '2026-01-01' }],
        error: null,
      };
      const result = await getMyWorkspace('u1');
      expect(result).toEqual({
        id: 'ws-1',
        name: 'Team',
        ownerId: 'u1',
        role: 'owner',
        stripeSubscriptionId: null,
        createdAt: '2026-01-01',
      });
    });

    it('returns null when RPC returns empty array', async () => {
      mockRpcResult = { data: [], error: null };
      const result = await getMyWorkspace('u1');
      expect(result).toBeNull();
    });
  });

  describe('getWorkspaceMembers', () => {
    it('returns mapped WorkspaceMember array', async () => {
      mockRpcResult = {
        data: [
          { id: 'wm-1', user_id: 'u1', email: 'a@b.com', role: 'owner', invited_at: '2026-01-01', accepted_at: '2026-01-01' },
        ],
        error: null,
      };
      const result = await getWorkspaceMembers('ws-1');
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('a@b.com');
      expect(result[0].role).toBe('owner');
    });

    it('throws when RPC returns error', async () => {
      mockRpcResult = { data: null, error: new Error('RPC failed') };
      await expect(getWorkspaceMembers('ws-1')).rejects.toThrow();
    });
  });

  describe('removeWorkspaceMember', () => {
    it('with userId deletes from workspace_members', async () => {
      // .delete().eq('workspace_id', ...).eq('user_id', ...) — 2 eq calls, last resolves
      const chain = chainWithTerminalEq(2, { error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await removeWorkspaceMember('ws-1', 'wm-1', 'u2');
      expect(supabase.from).toHaveBeenCalledWith('workspace_members');
    });

    it('with null userId deletes from workspace_invites', async () => {
      // .delete().eq('id', memberId) — 1 eq call
      const chain = chainWithTerminalEq(1, { error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await removeWorkspaceMember('ws-1', 'inv-1', null);
      expect(supabase.from).toHaveBeenCalledWith('workspace_invites');
    });
  });

  describe('updateMemberRole', () => {
    it('updates role via workspace_members', async () => {
      // .update({ role }).eq('id', ...).eq('workspace_id', ...) — 2 eq calls
      const chain = chainWithTerminalEq(2, { error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await updateMemberRole('ws-1', 'wm-1', 'viewer');
      expect(supabase.from).toHaveBeenCalledWith('workspace_members');
      expect(chain.update).toHaveBeenCalledWith({ role: 'viewer' });
    });
  });

  describe('renameWorkspace', () => {
    it('updates workspace name', async () => {
      const chain = chainWithTerminalEq(1, { error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await renameWorkspace('ws-1', 'New Name');
      expect(supabase.from).toHaveBeenCalledWith('workspaces');
      expect(chain.update).toHaveBeenCalledWith({ name: 'New Name' });
    });
  });

  describe('loadWorkspaceDiagrams', () => {
    it('returns diagrams excluding soft-deleted', async () => {
      // .select().eq().is().order() — order is terminal
      const chain = chainable({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'd1', title: 'Diagram 1', node_count: 5, edge_count: 3, updated_at: '2026-01-01', owner_id: 'u1', workspace_id: 'ws-1' },
          ],
          error: null,
        }),
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await loadWorkspaceDiagrams('ws-1');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Diagram 1');
    });
  });
});
