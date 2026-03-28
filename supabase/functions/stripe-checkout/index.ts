import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// Price IDs must be created in your Stripe Dashboard and set as env vars:
// STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_QUARTERLY, etc.
const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly:    Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") || "",
    quarterly:  Deno.env.get("STRIPE_PRICE_PRO_QUARTERLY") || "",
    semiannual: Deno.env.get("STRIPE_PRICE_PRO_SEMIANNUAL") || "",
    annual:     Deno.env.get("STRIPE_PRICE_PRO_ANNUAL") || "",
  },
  team: {
    monthly:    Deno.env.get("STRIPE_PRICE_TEAM_MONTHLY") || "",
    quarterly:  Deno.env.get("STRIPE_PRICE_TEAM_QUARTERLY") || "",
    semiannual: Deno.env.get("STRIPE_PRICE_TEAM_SEMIANNUAL") || "",
    annual:     Deno.env.get("STRIPE_PRICE_TEAM_ANNUAL") || "",
  },
};

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
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: "Missing Bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recommended pattern: pass JWT explicitly to getUser(token)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    console.log(JSON.stringify({ fn: 'stripe-checkout', msg: 'user resolved', userId: user?.id, authError: authError?.message }));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for DB operations only
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { plan, billing_cycle, app_url: clientAppUrl } = await req.json();
    if (!plan || !billing_cycle) {
      return new Response(JSON.stringify({ error: "Missing plan or billing_cycle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = PRICE_IDS[plan]?.[billing_cycle];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Invalid plan or billing cycle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { data: existingSub } = await serviceSupabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    const appUrl = clientAppUrl || Deno.env.get("APP_URL");
    if (!appUrl) {
      console.error(JSON.stringify({ fn: 'stripe-checkout', level: 'error', msg: 'APP_URL env var is not set' }));
      return new Response(JSON.stringify({ error: "APP_URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: { supabase_user_id: user.id, plan, billing_cycle },
      subscription_data: { metadata: { supabase_user_id: user.id, plan, billing_cycle } },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(JSON.stringify({ fn: 'stripe-checkout', level: 'error', msg: String(err) }));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
