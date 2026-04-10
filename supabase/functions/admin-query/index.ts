import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

async function getAdminUser(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const { data, error } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''))
  if (error || !data?.claims) return null
  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail || data.claims.email !== adminEmail) return null
  return data.claims
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
  })
  const admin = await getAdminUser(req, anonClient)
  if (!admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })

  const body = await req.json()
  const { resource, page = 1, pageSize = 20, filters } = body
  const offset = (page - 1) * pageSize

  try {
    if (resource === 'dashboard') {
      const [users, diagrams, workspaces, ai] = await Promise.all([
        supabase.from('profiles').select('id, plan', { count: 'exact' }),
        supabase.from('diagrams').select('id', { count: 'exact' }).is('deleted_at', null),
        supabase.from('workspaces').select('id', { count: 'exact' }),
        supabase.from('ai_requests').select('id', { count: 'exact' }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      ])

      const planDist: Record<string, number> = {}
      for (const u of users.data ?? []) {
        planDist[u.plan] = (planDist[u.plan] ?? 0) + 1
      }

      const { data: recent } = await supabase.from('profiles').select('id, email, plan, created_at, suspended_at').order('created_at', { ascending: false }).limit(10)

      return new Response(JSON.stringify({
        totalUsers: users.count ?? 0,
        totalDiagrams: diagrams.count ?? 0,
        totalWorkspaces: workspaces.count ?? 0,
        planDistribution: planDist,
        recentUsers: recent ?? [],
        aiRequests24h: ai.count ?? 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (resource === 'users') {
      let q = supabase.from('profiles').select('id, email, plan, created_at, suspended_at, avatar_url', { count: 'exact' })
      if (filters?.email) q = q.ilike('email', `%${filters.email}%`)
      q = q.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
      const { data, count, error } = await q
      if (error) throw error

      // Enrich with subscription info so the frontend can detect Stripe-managed plans
      const userIds = (data ?? []).map((u: any) => u.id)
      const { data: subs } = userIds.length > 0
        ? await supabase.from('subscriptions').select('user_id, status, stripe_subscription_id').in('user_id', userIds)
        : { data: [] }
      const subMap = Object.fromEntries((subs ?? []).map((s: any) => [s.user_id, s]))

      const enriched = (data ?? []).map((u: any) => ({
        ...u,
        subscription_status: subMap[u.id]?.status ?? null,
        stripe_subscription_id: subMap[u.id]?.stripe_subscription_id ?? null,
      }))

      return new Response(JSON.stringify({ data: enriched, count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (resource === 'diagrams') {
      let q = supabase.from('diagrams').select('id, title, owner_id, node_count, edge_count, updated_at, workspace_id', { count: 'exact' }).is('deleted_at', null)
      if (filters?.userId) q = q.eq('owner_id', filters.userId)
      q = q.order('updated_at', { ascending: false }).range(offset, offset + pageSize - 1)
      const { data: diagrams, count, error } = await q
      if (error) throw error

      const ownerIds = [...new Set((diagrams ?? []).map((d: any) => d.owner_id))]
      const { data: owners } = ownerIds.length > 0
        ? await supabase.from('profiles').select('id, email').in('id', ownerIds)
        : { data: [] }
      const emailMap = Object.fromEntries((owners ?? []).map((o: any) => [o.id, o.email]))

      const enriched = (diagrams ?? []).map((d: any) => ({
        ...d,
        owner_email: emailMap[d.owner_id] ?? 'unknown',
        workspace_name: null,
      }))

      return new Response(JSON.stringify({ data: enriched, count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (resource === 'workspaces') {
      const { data: ws, count, error } = await supabase.from('workspaces').select('id, name, owner_id, plan, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
      if (error) throw error

      const ownerIds = [...new Set((ws ?? []).map((w: any) => w.owner_id))]
      const { data: owners } = ownerIds.length > 0
        ? await supabase.from('profiles').select('id, email').in('id', ownerIds)
        : { data: [] }
      const emailMap = Object.fromEntries((owners ?? []).map((o: any) => [o.id, o.email]))

      const enriched = await Promise.all((ws ?? []).map(async (w: any) => {
        const { count: mc } = await supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', w.id)
        const { count: dc } = await supabase.from('diagrams').select('id', { count: 'exact', head: true }).eq('workspace_id', w.id).is('deleted_at', null)
        return { ...w, owner_email: emailMap[w.owner_id] ?? 'unknown', member_count: mc ?? 0, diagram_count: dc ?? 0 }
      }))

      return new Response(JSON.stringify({ data: enriched, count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (resource === 'update-feature-flag') {
      const { key, enabled, description } = body
      const updates: any = {}
      if (typeof enabled === 'boolean') updates.enabled = enabled
      if (typeof description === 'string') updates.description = description
      updates.updated_at = new Date().toISOString()
      const { error } = await supabase.from('feature_flags').update(updates).eq('key', key)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (resource === 'create-feature-flag') {
      const { key, description } = body
      const { error } = await supabase.from('feature_flags').insert({ key, description, enabled: false })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Unknown resource' }), { status: 400, headers: corsHeaders })
  } catch (err) {
    console.error('admin-query error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
