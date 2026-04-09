import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
  })
  const { data, error } = await anonClient.auth.getClaims(req.headers.get('Authorization')?.replace('Bearer ', '') ?? '')
  if (error || !data?.claims || data.claims.email !== Deno.env.get('ADMIN_EMAIL')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500, headers: corsHeaders })

  const { action, subscriptionId } = await req.json()

  if (action === 'cancel-subscription' && subscriptionId) {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    const result = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: result.error?.message ?? 'Stripe error' }), { status: res.status, headers: corsHeaders })
    return new Response(JSON.stringify({ ok: true, subscription: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
})
