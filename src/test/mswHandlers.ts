import { http, HttpResponse } from 'msw';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';

/** Handlers that mock Supabase REST + Edge Function endpoints */
export const handlers = [
  // Mock diagrams table UPDATE (for saveDiagram existing)
  http.patch(`${SUPABASE_URL}/rest/v1/diagrams`, async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    return HttpResponse.json(
      [
        {
          id: id?.replace('eq.', '') ?? 'test-id',
          title: 'Test Diagram',
          owner_id: 'user-1',
          share_token: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: new Date().toISOString(),
        },
      ],
      { status: 200 },
    );
  }),

  // Mock diagrams table INSERT (for saveDiagram new)
  http.post(`${SUPABASE_URL}/rest/v1/diagrams`, () => {
    return HttpResponse.json(
      [
        {
          id: 'new-diagram-id',
          title: 'Test Diagram',
          owner_id: 'user-1',
          share_token: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: new Date().toISOString(),
        },
      ],
      { status: 201 },
    );
  }),

  // Mock diagram-crypto Edge Function
  http.post(`${SUPABASE_URL}/functions/v1/diagram-crypto`, async ({ request }) => {
    const body = (await request.json()) as { action: string; nodes: unknown; edges: unknown };
    if (body.action === 'encrypt') {
      return HttpResponse.json({
        nodes: { iv: 'mock-iv', ciphertext: 'mock-cipher-nodes' },
        edges: { iv: 'mock-iv', ciphertext: 'mock-cipher-edges' },
      });
    }
    // decrypt → return as-is (mock)
    return HttpResponse.json({ nodes: body.nodes, edges: body.edges });
  }),

  // Mock get_user_diagram_count RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_user_diagram_count`, () => {
    return HttpResponse.json(2);
  }),

  // Mock get_user_plan_limits RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_user_plan_limits`, () => {
    return HttpResponse.json([
      {
        plan: 'free',
        max_diagrams: 5,
        max_nodes_per_diagram: 50,
        max_collaborators_per_diagram: 1,
        allowed_export_formats: ['png', 'json'],
        watermark_enabled: false,
        realtime_collab_enabled: false,
        email_sharing_enabled: false,
      },
    ]);
  }),
];
