import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '@/test/mswServer';
import { useDiagramStore } from '@/store/diagramStore';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_DIAGRAM_ID = '00000000-0000-0000-0000-000000000002';
const TEST_WS_ID = '00000000-0000-0000-0000-000000000003';
vi.mock('@/services/cryptoService', () => ({
  encryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({
    nodes: { iv: 'iv', ciphertext: 'ct' },
    edges: { iv: 'iv', ciphertext: 'ct' },
  })),
  decryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({ nodes, edges })),
}));

// Dynamic import after mocks
const { saveDiagram, saveSharedDiagram } = await import('@/services/diagramService');

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';

describe('saveDiagram', () => {
  beforeEach(() => {
    useDiagramStore.getState().setNodes([]);
    useDiagramStore.getState().setEdges([]);
  });

  it('creates a new diagram when no existingId is provided', async () => {
    const record = await saveDiagram('My Diagram', [], [], 'user-1');
    expect(record).toBeDefined();
    expect(record.title).toBe('Test Diagram');
    expect(record.id).toBe('new-diagram-id');
  });

  it('updates an existing diagram when existingId is provided', async () => {
    const record = await saveDiagram('Updated', [], [], 'user-1', 'existing-id');
    expect(record).toBeDefined();
    expect(record.nodes).toEqual([]);
    expect(record.edges).toEqual([]);
  });

  it('throws on server error during insert', async () => {
    mswServer.use(
      http.post(`${SUPABASE_URL}/rest/v1/diagrams`, () => {
        return HttpResponse.json({ message: 'Internal error' }, { status: 500 });
      }),
    );
    await expect(saveDiagram('Fail', [], [], 'user-1')).rejects.toThrow();
  });

  it('throws on server error during update', async () => {
    mswServer.use(
      http.patch(`${SUPABASE_URL}/rest/v1/diagrams`, () => {
        return HttpResponse.json({ message: 'Internal error' }, { status: 500 });
      }),
    );
    await expect(saveDiagram('Fail', [], [], 'user-1', 'existing-id')).rejects.toThrow();
  });

  it('includes workspace_id in insert when provided', async () => {
    let capturedBody: unknown = null;
    mswServer.use(
      http.post(`${SUPABASE_URL}/rest/v1/diagrams`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          [{
            id: 'ws-diagram',
            title: 'WS Diagram',
            owner_id: 'user-1',
            share_token: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: new Date().toISOString(),
          }],
          { status: 201 },
        );
      }),
    );
    await saveDiagram('WS Diagram', [], [], 'user-1', undefined, 'workspace-abc');
    expect(capturedBody).toBeDefined();
    expect((capturedBody as Record<string, unknown>).workspace_id).toBe('workspace-abc');
  });
});

describe('saveSharedDiagram', () => {
  it('updates a shared diagram without owner_id check', async () => {
    mswServer.use(
      http.patch(`${SUPABASE_URL}/rest/v1/diagrams`, () => {
        return HttpResponse.json([], { status: 200 });
      }),
    );
    await expect(saveSharedDiagram('shared-id', [], [])).resolves.toBeUndefined();
  });

  it('throws on permission error', async () => {
    mswServer.use(
      http.patch(`${SUPABASE_URL}/rest/v1/diagrams`, () => {
        return HttpResponse.json({ message: 'RLS violation' }, { status: 403 });
      }),
    );
    await expect(saveSharedDiagram('shared-id', [], [])).rejects.toThrow();
  });
});
