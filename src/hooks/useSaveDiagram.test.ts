import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '@/test/mswServer';
import { useDiagramStore } from '@/store/diagramStore';

const U1 = '00000000-0000-0000-0000-000000000001';
const D1 = '00000000-0000-0000-0000-000000000002';
const D2 = '00000000-0000-0000-0000-000000000003';
const WS = '00000000-0000-0000-0000-000000000004';

vi.mock('@/services/cryptoService', () => ({
  encryptDiagramData: vi.fn(async () => ({
    nodes: { iv: 'iv', ciphertext: 'ct' },
    edges: { iv: 'iv', ciphertext: 'ct' },
  })),
  decryptDiagramData: vi.fn(async (nodes: unknown, edges: unknown) => ({ nodes, edges })),
}));

const { saveDiagram, saveSharedDiagram } = await import('@/services/diagramService');

const BASE = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';

describe('saveDiagram', () => {
  beforeEach(() => {
    // Override MSW handlers for each test to use valid UUIDs
    mswServer.use(
      http.post(`${BASE}/rest/v1/diagrams`, () =>
        HttpResponse.json([{
          id: D1, title: 'New Diagram', owner_id: U1,
          share_token: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:01Z',
        }], { status: 201 }),
      ),
      http.patch(`${BASE}/rest/v1/diagrams`, () =>
        HttpResponse.json([{
          id: D2, title: 'Updated', owner_id: U1,
          share_token: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:02Z',
        }], { status: 200 }),
      ),
    );
  });

  it('creates a new diagram when no existingId is provided', async () => {
    const record = await saveDiagram('My Diagram', [], [], U1);
    expect(record).toBeDefined();
    expect(record.id).toBe(D1);
  });

  it('updates an existing diagram when existingId is provided', async () => {
    const record = await saveDiagram('Updated', [], [], U1, D2);
    expect(record).toBeDefined();
    expect(record.nodes).toEqual([]);
  });

  it('throws on server error during insert', async () => {
    mswServer.use(
      http.post(`${BASE}/rest/v1/diagrams`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })),
    );
    await expect(saveDiagram('Fail', [], [], U1)).rejects.toThrow();
  });

  it('throws on server error during update', async () => {
    mswServer.use(
      http.patch(`${BASE}/rest/v1/diagrams`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })),
    );
    await expect(saveDiagram('Fail', [], [], U1, D2)).rejects.toThrow();
  });

  it('includes workspace_id in insert payload', async () => {
    let body: Record<string, unknown> = {};
    mswServer.use(
      http.post(`${BASE}/rest/v1/diagrams`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{
          id: D1, title: 'WS', owner_id: U1,
          share_token: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:03Z',
        }], { status: 201 });
      }),
    );
    await saveDiagram('WS', [], [], U1, undefined, WS);
    expect(body.workspace_id).toBe(WS);
  });
});

describe('saveSharedDiagram', () => {
  it('updates a shared diagram successfully', async () => {
    mswServer.use(
      http.patch(`${BASE}/rest/v1/diagrams`, () =>
        HttpResponse.json([], { status: 200 })),
    );
    await expect(saveSharedDiagram(D1, [], [])).resolves.toBeUndefined();
  });

  it('throws on permission error', async () => {
    mswServer.use(
      http.patch(`${BASE}/rest/v1/diagrams`, () =>
        HttpResponse.json({ message: 'forbidden' }, { status: 403 })),
    );
    await expect(saveSharedDiagram(D1, [], [])).rejects.toThrow();
  });
});
