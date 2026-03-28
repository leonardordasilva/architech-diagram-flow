import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",").map((o) => o.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = isLocalhost || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "Missing session_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Source of truth: Stripe session metadata (set by us during checkout creation)
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log(JSON.stringify({ fn: 'verify-checkout', msg: 'session retrieved', sessionId: session.id, paymentStatus: session.payment_status, metaUserId: session.metadata?.supabase_user_id }));

    const userId = session.metadata?.supabase_user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Session has no user metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ verified: false, status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = session.metadata?.plan || "pro";
    const billingCycle = session.metadata?.billing_cycle;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as any)?.id || "";

    let periodStart: number | undefined;
    let periodEnd: number | undefined;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      periodStart = sub.current_period_start;
      periodEnd = sub.current_period_end;
    }

    // Service role client for DB writes
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const record: Record<string, unknown> = {
      user_id: userId,
      plan,
      status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    };
    if (billingCycle) record.billing_cycle = billingCycle;
    if (periodStart) record.current_period_start = new Date(periodStart * 1000).toISOString();
    if (periodEnd) record.current_period_end = new Date(periodEnd * 1000).toISOString();

    const { error: upsertError } = await serviceSupabase
      .from("subscriptions")
      .upsert(record, { onConflict: "user_id" });

    if (upsertError) throw upsertError;

    await serviceSupabase
      .from("profiles")
      .update({ plan })
      .eq("id", userId);

    console.log(JSON.stringify({ fn: 'verify-checkout', msg: 'subscription updated', userId, plan }));

    return new Response(JSON.stringify({ verified: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(JSON.stringify({ fn: 'verify-checkout', level: 'error', msg: String(err) }));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
