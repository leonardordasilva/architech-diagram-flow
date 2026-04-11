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

  // Service role client to update the DB directly after Stripe calls
  const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { action, subscriptionId, newPlan, newCycle } = await req.json()

  // Immediate cancellation — user loses access now
  if (action === 'cancel-subscription' && subscriptionId) {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    const result = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: result.error?.message ?? 'Stripe error' }), { status: res.status, headers: corsHeaders })

    await serviceClient
      .from('subscriptions')
      .update({
        status: 'canceled',
        plan: 'free',
        cancel_at_period_end: false,
        billing_cycle: null,
        current_period_start: null,
        current_period_end: null,
      })
      .eq('stripe_subscription_id', subscriptionId)

    return new Response(JSON.stringify({ ok: true, subscription: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Soft cancel — user keeps access until end of current billing period
  if (action === 'cancel-at-period-end' && subscriptionId) {
    const body = new URLSearchParams({ cancel_at_period_end: 'true' })
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const result = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: result.error?.message ?? 'Stripe error' }), { status: res.status, headers: corsHeaders })

    await serviceClient
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('stripe_subscription_id', subscriptionId)

    return new Response(JSON.stringify({ ok: true, subscription: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Reactivate — remove scheduled cancellation, keep subscription active
  if (action === 'reactivate' && subscriptionId) {
    const body = new URLSearchParams({ cancel_at_period_end: 'false' })
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const result = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: result.error?.message ?? 'Stripe error' }), { status: res.status, headers: corsHeaders })

    await serviceClient
      .from('subscriptions')
      .update({ cancel_at_period_end: false })
      .eq('stripe_subscription_id', subscriptionId)

    return new Response(JSON.stringify({ ok: true, subscription: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Change plan — upgrade or downgrade to a different plan/cycle via Stripe price swap
  if (action === 'change-plan' && subscriptionId && newPlan && newCycle) {
    const priceEnvKey = `STRIPE_PRICE_${(newPlan as string).toUpperCase()}_${(newCycle as string).toUpperCase()}`
    const priceId = Deno.env.get(priceEnvKey)
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Price ID não configurado para ${newPlan}/${newCycle} (${priceEnvKey})` }),
        { status: 500, headers: corsHeaders },
      )
    }

    // Fetch current subscription to get the subscription item ID
    const getRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!getRes.ok) {
      const err = await getRes.json()
      return new Response(JSON.stringify({ error: err.error?.message ?? 'Failed to fetch subscription' }), { status: getRes.status, headers: corsHeaders })
    }
    const currentSub = await getRes.json()
    const itemId = currentSub.items?.data?.[0]?.id

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'Subscription item não encontrado' }), { status: 500, headers: corsHeaders })
    }

    // Swap the price on the existing subscription.
    // billing_cycle_anchor=now resets the period immediately so current_period_end
    // reflects the new cycle length. create_prorations handles credits/charges for
    // unused time on the old plan.
    const body = new URLSearchParams({
      [`items[0][id]`]: itemId,
      [`items[0][price]`]: priceId,
      proration_behavior: 'create_prorations',
      billing_cycle_anchor: 'now',
    })
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const result = await res.json()
    if (!res.ok) return new Response(JSON.stringify({ error: result.error?.message ?? 'Stripe error' }), { status: res.status, headers: corsHeaders })

    // Re-fetch the subscription from Stripe to get the authoritative current_period_end.
    // The POST response can return stale period data when billing_cycle_anchor is used;
    // a subsequent GET always reflects the fully-processed state.
    const refreshRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    const freshSub = refreshRes.ok ? await refreshRes.json() : result

    // Prefer the re-fetched value; fall back to the POST response value
    const rawPeriodEnd = freshSub.current_period_end ?? result.current_period_end
    const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : undefined

    await serviceClient
      .from('subscriptions')
      .update({
        plan: newPlan,
        billing_cycle: newCycle,
        ...(periodEnd ? { current_period_end: periodEnd } : {}),
      })
      .eq('stripe_subscription_id', subscriptionId)

    return new Response(JSON.stringify({ ok: true, subscription: freshSub }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Sync from Stripe — re-fetch subscription state and update the DB
  if (action === 'sync-from-stripe' && subscriptionId) {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    })
    if (!res.ok) {
      const err = await res.json()
      return new Response(JSON.stringify({ error: err.error?.message ?? 'Failed to fetch subscription from Stripe' }), { status: res.status, headers: corsHeaders })
    }
    const sub = await res.json()

    // Log the full raw response so we can inspect any field name discrepancies in Supabase logs
    console.log('sync-from-stripe stripe response keys:', Object.keys(sub).join(', '))
    console.log('sync-from-stripe raw period fields:', JSON.stringify({
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
    }))

    // Convert Unix timestamps — Number() coerces string digits that some API versions return
    const periodStart = sub.current_period_start ? new Date(Number(sub.current_period_start) * 1000).toISOString() : null
    const periodEnd   = sub.current_period_end   ? new Date(Number(sub.current_period_end)   * 1000).toISOString() : null

    // Always write all synced fields — even if null, so stale values get cleared
    const toUpdate: Record<string, unknown> = {
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    }

    // 1st attempt: update by stripe_subscription_id
    const { data: bySubId, error: e1 } = await serviceClient
      .from('subscriptions')
      .update(toUpdate)
      .eq('stripe_subscription_id', subscriptionId)
      .select('id, current_period_end')

    if (e1) {
      return new Response(JSON.stringify({ error: `DB update error: ${e1.message}` }), { status: 500, headers: corsHeaders })
    }

    if (bySubId && bySubId.length > 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          updated: bySubId,
          stripe_period_end: periodEnd,
          _debug: { raw_period_end: sub.current_period_end, raw_period_start: sub.current_period_start, status: sub.status },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2nd attempt: stripe_subscription_id not in DB — try stripe_customer_id and fix the missing column
    const customerId = sub.customer as string | undefined
    if (!customerId) {
      return new Response(JSON.stringify({ error: `No row found for stripe_subscription_id=${subscriptionId}` }), { status: 404, headers: corsHeaders })
    }

    const { data: byCustId, error: e2 } = await serviceClient
      .from('subscriptions')
      .update({ ...toUpdate, stripe_subscription_id: subscriptionId })
      .eq('stripe_customer_id', customerId)
      .select('id, current_period_end')

    if (e2) {
      return new Response(JSON.stringify({ error: `DB update (by customer) error: ${e2.message}` }), { status: 500, headers: corsHeaders })
    }

    if (!byCustId || byCustId.length === 0) {
      return new Response(JSON.stringify({ error: `Subscription not found in DB. stripe_subscription_id=${subscriptionId}, stripe_customer_id=${customerId}` }), { status: 404, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        updated: byCustId,
        stripe_period_end: periodEnd,
        _debug: { raw_period_end: sub.current_period_end, raw_period_start: sub.current_period_start, status: sub.status },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
})
