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

  const { diagramId } = await req.json()
  if (!diagramId) return new Response(JSON.stringify({ error: 'Missing diagramId' }), { status: 400, headers: corsHeaders })

  await supabase.from('diagram_shares').delete().eq('diagram_id', diagramId)
  const { error: e1 } = await supabase.from('diagrams').delete().eq('id', diagramId)
  if (e1) return new Response(JSON.stringify({ error: e1.message }), { status: 500, headers: corsHeaders })

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
