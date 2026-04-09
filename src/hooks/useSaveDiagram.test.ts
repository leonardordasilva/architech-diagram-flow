import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSaveDiagram = vi.fn();
const mockSaveSharedDiagram = vi.fn();
vi.mock('@/services/diagramService', () => ({
  saveDiagram: (...args: unknown[]) => mockSaveDiagram(...args),
  saveSharedDiagram: (...args: unknown[]) => mockSaveSharedDiagram(...args),
}));

vi.mock('@/services/cryptoService', () => ({
  encryptDiagramData: vi.fn(async (n: unknown, e: unknown) => ({ nodes: n, edges: e })),
  decryptDiagramData: vi.fn(async (n: unknown, e: unknown) => ({ nodes: n, edges: e })),
}));

const mockUser = { id: 'user-1', email: 'test@test.com' };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, loading: false, signOut: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => {
  const mockToast = vi.fn();
  return { toast: mockToast, __mockToast: mockToast };
});
// Re-import to get reference
import { toast as mockToast } from '@/hooks/use-toast';

vi.mock('@/hooks/useAutoSave', () => ({
  clearAutoSave: vi.fn(),
  useAutoSave: () => ({ saveStatus: 'idle' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { useDiagramStore } from '@/store/diagramStore';
import { usePlanStore } from '@/store/planStore';
import { useSaveDiagram } from '@/hooks/useSaveDiagram';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSaveDiagram hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveDiagram.mockResolvedValue({ id: 'new-diagram-id' });
    mockSaveSharedDiagram.mockResolvedValue(undefined);
    // Reset store
    useDiagramStore.setState({
      nodes: [{ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'A', type: 'service' } }],
      edges: [],
      diagramName: 'Test',
      currentDiagramId: undefined,
      isCollaborator: false,
      isDirty: true,
    });
    usePlanStore.setState({ limits: { maxDiagrams: null, maxNodesPerDiagram: null, maxCollaboratorsPerDiagram: null, allowedExportFormats: ['png', 'json'], watermarkEnabled: false, realtimeCollabEnabled: false, emailSharingEnabled: false, plan: 'free' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Grupo 1: Falha e consistência de estado ─────────────────────────────

  describe('falha de save e consistência de estado', () => {
    it('não atualiza diagramId quando saveDiagram lança exceção', async () => {
      mockSaveDiagram.mockRejectedValueOnce(new Error('Network error'));
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(useDiagramStore.getState().currentDiagramId).toBeUndefined();
    });

    it('exibe toast de erro quando save falha', async () => {
      mockSaveDiagram.mockRejectedValueOnce(new Error('DB timeout'));
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });

    it('reseta saving=false mesmo quando save falha', async () => {
      mockSaveDiagram.mockRejectedValueOnce(new Error('fail'));
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(result.current.saving).toBe(false);
    });
  });

  // ─── Grupo 2: Guard de cooldown ──────────────────────────────────────────

  describe('guard de cooldown (SAVE_COOLDOWN_MS)', () => {
    it('ignora segundo save chamado dentro do cooldown', async () => {
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      // Reset diagramId so the second call would be a new diagram
      useDiagramStore.setState({ currentDiagramId: undefined });
      await act(async () => { await result.current.save(); });
      expect(mockSaveDiagram).toHaveBeenCalledTimes(1);
    });

    it('permite segundo save após cooldown expirar', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      vi.advanceTimersByTime(2000);
      useDiagramStore.setState({ currentDiagramId: undefined });
      await act(async () => { await result.current.save(); });
      expect(mockSaveDiagram).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  // ─── Grupo 3: Limites de plano ───────────────────────────────────────────

  describe('limites de plano', () => {
    it('chama onDiagramLimitReached quando limite é atingido', async () => {
      // Simulate the limit check via the RPC mock — we need to mock supabase.rpc
      // Since the hook uses supabase.rpc internally and that's hard to mock via MSW in this test,
      // we test via the DIAGRAM_LIMIT_EXCEEDED error path
      mockSaveDiagram.mockRejectedValueOnce(new Error('DIAGRAM_LIMIT_EXCEEDED'));
      const onLimit = vi.fn();
      const { result } = renderHook(() => useSaveDiagram({ onDiagramLimitReached: onLimit }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(onLimit).toHaveBeenCalledOnce();
    });

    it('permite save quando plano tem limite null (ilimitado)', async () => {
      usePlanStore.setState({ limits: { ...usePlanStore.getState().limits, maxDiagrams: null } });
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(mockSaveDiagram).toHaveBeenCalledOnce();
    });
  });

  // ─── Grupo 4: Colaborador vs. dono ───────────────────────────────────────

  describe('colaborador vs. dono', () => {
    it('usa saveSharedDiagram quando isCollaborator e diagramId existe', async () => {
      useDiagramStore.setState({ isCollaborator: true, currentDiagramId: 'diag-1' });
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(mockSaveSharedDiagram).toHaveBeenCalled();
      expect(mockSaveDiagram).not.toHaveBeenCalled();
    });

    it('usa saveDiagram quando usuário é o dono (sem shareToken)', async () => {
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(mockSaveDiagram).toHaveBeenCalled();
      expect(mockSaveSharedDiagram).not.toHaveBeenCalled();
    });
  });

  // ─── Grupo 5: Sucesso básico ─────────────────────────────────────────────

  describe('save bem-sucedido', () => {
    it('atualiza diagramId após save de novo diagrama', async () => {
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(useDiagramStore.getState().currentDiagramId).toBe('new-diagram-id');
    });

    it('exibe toast de sucesso após save', async () => {
      const { result } = renderHook(() => useSaveDiagram({ }), { wrapper });
      await act(async () => { await result.current.save(); });
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'save.savedToCloud' }));
    });
  });
});
