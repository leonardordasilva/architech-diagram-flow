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

  // Mock save-diagram Edge Function
  http.post(`${SUPABASE_URL}/functions/v1/save-diagram`, () => {
    return HttpResponse.json({
      id: 'saved-diagram-id',
      title: 'Test Diagram',
      owner_id: 'user-1',
      share_token: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: new Date().toISOString(),
    });
  }),

  // Mock diagram_shares table
  http.get(`${SUPABASE_URL}/rest/v1/diagram_shares`, () => {
    return HttpResponse.json([
      { id: 'share-1', diagram_id: 'diag-1', owner_id: 'user-1', shared_with_id: 'user-2', created_at: '2026-01-01T00:00:00Z' },
    ]);
  }),
  http.post(`${SUPABASE_URL}/rest/v1/diagram_shares`, () => {
    return HttpResponse.json([{ id: 'share-new' }], { status: 201 });
  }),
  http.delete(`${SUPABASE_URL}/rest/v1/diagram_shares`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Mock profiles table
  http.get(`${SUPABASE_URL}/rest/v1/profiles`, () => {
    return HttpResponse.json([{ id: 'user-2', email: 'collab@test.com' }]);
  }),

  // Mock search_users_by_email RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/search_users_by_email`, () => {
    return HttpResponse.json([{ id: 'user-2', email: 'collab@test.com' }]);
  }),

  // Mock share-diagram Edge Function
  http.post(`${SUPABASE_URL}/functions/v1/share-diagram`, () => {
    return HttpResponse.json({ shareUrl: 'https://app.test/diagram/abc123', shareToken: 'abc123' });
  }),

  // Mock get_user_workspace RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_user_workspace`, () => {
    return HttpResponse.json([
      { id: 'ws-1', name: 'My Team', owner_id: 'user-1', role: 'owner', stripe_subscription_id: null, created_at: '2026-01-01T00:00:00Z' },
    ]);
  }),

  // Mock get_workspace_members RPC
  http.post(`${SUPABASE_URL}/rest/v1/rpc/get_workspace_members`, () => {
    return HttpResponse.json([
      { id: 'wm-1', user_id: 'user-1', email: 'owner@test.com', role: 'owner', invited_at: '2026-01-01T00:00:00Z', accepted_at: '2026-01-01T00:00:00Z' },
      { id: 'wm-2', user_id: 'user-2', email: 'editor@test.com', role: 'editor', invited_at: '2026-01-01T00:00:00Z', accepted_at: '2026-01-02T00:00:00Z' },
    ]);
  }),

  // Mock feature_flags table
  http.get(`${SUPABASE_URL}/rest/v1/feature_flags`, () => {
    return HttpResponse.json([{ key: 'atomic_save', enabled: true }]);
  }),
];
