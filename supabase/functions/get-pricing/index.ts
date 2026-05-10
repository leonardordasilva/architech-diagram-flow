import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_ENV_VARS = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_QUARTERLY",
  "STRIPE_PRICE_PRO_SEMIANNUAL",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_TEAM_MONTHLY",
  "STRIPE_PRICE_TEAM_QUARTERLY",
  "STRIPE_PRICE_TEAM_SEMIANNUAL",
  "STRIPE_PRICE_TEAM_ANNUAL",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Fetch exchange rate (USD to BRL)
    const exchangeRes = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL");
    const exchangeData = await exchangeRes.json();
    console.log("Exchange Data:", JSON.stringify(exchangeData));
    
    if (!exchangeData.USDBRL) {
      throw new Error(`Invalid exchange data structure: ${JSON.stringify(exchangeData)}`);
    }
    const rate = parseFloat(exchangeData.USDBRL.bid);

    // 2. Map environment variables to price IDs
    const priceMap: Record<string, string> = {};
    for (const envVar of PRICE_ENV_VARS) {
      const id = Deno.env.get(envVar);
      if (id) {
        priceMap[envVar] = id;
      }
    }

    const priceIds = Object.values(priceMap);
    if (priceIds.length === 0) {
      throw new Error("No Stripe price IDs configured in environment variables.");
    }

    // 3. Fetch price details from Stripe
    // We fetch them all in parallel
    const stripePrices = await Promise.all(
      priceIds.map(id => stripe.prices.retrieve(id))
    );

    // 4. Organize data by plan and cycle
    const pricing: any = {
      usd: { free: { monthly: "$0", quarterly: "$0", semiannual: "$0", annual: "$0" } },
      brl: { free: { monthly: "R$ 0", quarterly: "R$ 0", semiannual: "R$ 0", annual: "R$ 0" } },
      exchangeRate: rate,
    };

    for (const envVar of PRICE_ENV_VARS) {
      const priceId = priceMap[envVar];
      const stripePrice = stripePrices.find(p => p.id === priceId);
      
      if (stripePrice && stripePrice.unit_amount !== null) {
        const parts = envVar.split("_");
        const plan = parts[2].toLowerCase(); // PRO or TEAM
        const cycle = parts[3].toLowerCase(); // MONTHLY, etc.
        
        const usdAmount = stripePrice.unit_amount / 100;
        const brlAmount = usdAmount * rate;

        if (!pricing.usd[plan]) pricing.usd[plan] = {};
        if (!pricing.brl[plan]) pricing.brl[plan] = {};

        pricing.usd[plan][cycle] = `$${usdAmount.toFixed(0)}`;
        pricing.brl[plan][cycle] = `R$ ${brlAmount.toFixed(0)}`;
      }
    }

    return new Response(JSON.stringify(pricing), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in get-pricing:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
