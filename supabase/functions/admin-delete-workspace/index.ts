import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
  })
  const { data, error } = await anonClient.auth.getClaims(req.headers.get('Authorization')?.replace('Bearer ', '') ?? '')
  if (error || !data?.claims || data.claims.email !== Deno.env.get('ADMIN_EMAIL')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
  }

  const { workspaceId } = await req.json()
  if (!workspaceId) return new Response(JSON.stringify({ error: 'Missing workspaceId' }), { status: 400, headers: corsHeaders })

  try {
    await supabase.from('workspace_invites').delete().eq('workspace_id', workspaceId)
    await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId)

    const { data: diagrams } = await supabase.from('diagrams').select('id').eq('workspace_id', workspaceId)
    const diagramIds = (diagrams ?? []).map((d: any) => d.id)
    if (diagramIds.length > 0) {
      await supabase.from('diagram_shares').delete().in('diagram_id', diagramIds)
      await supabase.from('diagrams').delete().eq('workspace_id', workspaceId)
    }

    await supabase.from('workspaces').delete().eq('id', workspaceId)

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('admin-delete-workspace error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
