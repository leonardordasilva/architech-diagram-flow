import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const serviceSupabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/** Map Stripe plan nickname/metadata to our plan enum */
function resolvePlan(metadata: Stripe.Metadata | null): string {
  if (!metadata) return "pro";
  return metadata.plan || "pro";
}

/**
 * Resolve plan from the actual Price ID on the subscription item.
 * This is reliable even when the user upgrades/downgrades via the Stripe portal
 * (portal changes don't update subscription metadata).
 */
function resolvePlanFromPriceId(priceId: string): string {
  const teamPrices = [
    Deno.env.get("STRIPE_PRICE_TEAM_MONTHLY"),
    Deno.env.get("STRIPE_PRICE_TEAM_QUARTERLY"),
    Deno.env.get("STRIPE_PRICE_TEAM_SEMIANNUAL"),
    Deno.env.get("STRIPE_PRICE_TEAM_ANNUAL"),
  ].filter(Boolean);

  const proPrices = [
    Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"),
    Deno.env.get("STRIPE_PRICE_PRO_QUARTERLY"),
    Deno.env.get("STRIPE_PRICE_PRO_SEMIANNUAL"),
    Deno.env.get("STRIPE_PRICE_PRO_ANNUAL"),
  ].filter(Boolean);

  if (teamPrices.includes(priceId)) return "team";
  if (proPrices.includes(priceId)) return "pro";
  return "pro"; // safe fallback
}

/** Derive billing_cycle from Stripe price recurring interval */
function resolveBillingCycle(price: Stripe.Price): string | undefined {
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count ?? 1;
  if (interval === "month") {
    if (count === 1) return "monthly";
    if (count === 3) return "quarterly";
    if (count === 6) return "semiannual";
  }
  if (interval === "year") return "annual";
  return undefined;
}

/** Update subscriptions + profiles.plan in one shot */
async function upsertSubscription(params: {
  userId: string;
  plan: string;
  status: string;
  billingCycle?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}) {
  const record: Record<string, unknown> = {
    user_id: params.userId,
    plan: params.plan,
    status: params.status,
    updated_at: new Date().toISOString(),
  };
  if (params.billingCycle) record.billing_cycle = params.billingCycle;
  if (params.stripeCustomerId) record.stripe_customer_id = params.stripeCustomerId;
  if (params.stripeSubscriptionId) record.stripe_subscription_id = params.stripeSubscriptionId;
  if (params.currentPeriodStart) record.current_period_start = new Date(params.currentPeriodStart * 1000).toISOString();
  if (params.currentPeriodEnd) record.current_period_end = new Date(params.currentPeriodEnd * 1000).toISOString();
  if (params.cancelAtPeriodEnd !== undefined) {
    record.cancel_at_period_end = params.cancelAtPeriodEnd;
  }

  await serviceSupabase
    .from("subscriptions")
    .upsert(record, { onConflict: "user_id" });

  await serviceSupabase
    .from("profiles")
    .update({ plan: params.plan })
    .eq("id", params.userId);
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error(JSON.stringify({ fn: 'stripe-webhook', level: 'error', msg: 'signature verification failed', error: String(err) }));
    return new Response(`Webhook error: ${err}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        const plan = session.metadata?.plan || "pro";
        const billingCycle = session.metadata?.billing_cycle;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || "";
        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id || "";

        let periodStart: number | undefined;
        let periodEnd: number | undefined;

        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodStart = sub.current_period_start;
          periodEnd = sub.current_period_end;
        }

        await upsertSubscription({
          userId,
          plan,
          status: "active",
          billingCycle,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        // Try metadata first; fall back to DB lookup by stripe_customer_id
        let userId = sub.metadata?.supabase_user_id;
        if (!userId) {
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          const { data: dbSub } = await serviceSupabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = dbSub?.user_id;
        }
        if (!userId) {
          console.warn(JSON.stringify({ fn: 'stripe-webhook', msg: 'subscription.updated: no user found', subId: sub.id }));
          break;
        }

        // Resolve plan from actual price ID (reliable after portal upgrades/downgrades)
        const priceId = sub.items.data[0]?.price?.id ?? "";
        const plan = priceId ? resolvePlanFromPriceId(priceId) : resolvePlan(sub.metadata);
        const billingCycle = sub.items.data[0]?.price
          ? resolveBillingCycle(sub.items.data[0].price)
          : undefined;

        // T3: save cancel_at_period_end flag
        const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;

        await upsertSubscription({
          userId,
          plan,
          status: sub.status,
          billingCycle,
          stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd,
        });

        // saas0003: reconciliar quantity de editores no plano Team
        if (plan === "team") {
          const { data: workspace } = await serviceSupabase
            .from("workspaces")
            .select("id")
            .eq("stripe_subscription_id", sub.id)
            .maybeSingle();

          if (workspace) {
            const { data: editorCount } = await serviceSupabase
              .rpc("get_workspace_editor_count", { p_workspace_id: workspace.id });

            const realCount = Math.max(3, editorCount ?? 0);
            const stripeQuantity = sub.quantity ?? 0;
            if (realCount !== stripeQuantity) {
              await stripe.subscriptions.update(sub.id, { quantity: realCount });
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        let userId = sub.metadata?.supabase_user_id;
        if (!userId) {
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          const { data: dbSub } = await serviceSupabase
            .from("subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          userId = dbSub?.user_id;
        }
        if (!userId) break;

        const priceId = sub.items.data[0]?.price?.id ?? "";
        const wasTeam = priceId ? resolvePlanFromPriceId(priceId) === "team" : resolvePlan(sub.metadata) === "team";

        await upsertSubscription({
          userId,
          plan: "free",
          status: "canceled",
          stripeSubscriptionId: sub.id,
          cancelAtPeriodEnd: false,
        });

        // saas0003: ao cancelar plano Team, remover subscription_id do workspace
        if (wasTeam) {
          await serviceSupabase
            .from("workspaces")
            .update({ stripe_subscription_id: null })
            .eq("stripe_subscription_id", sub.id);
        }
        break;
      }

      // T1: Handle invoice.paid — update current_period_end on subscription renewal
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        const subscriptionId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subscriptionId) break;

        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id || "";

        const { data: dbSub } = await serviceSupabase
          .from("subscriptions")
          .select("user_id, plan")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!dbSub?.user_id) {
          console.warn(JSON.stringify({ fn: 'stripe-webhook', msg: 'invoice.paid: no user found', customerId }));
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        // Resolve plan from actual price ID — reliable even after portal upgrades/downgrades
        const renewedPriceId = sub.items.data[0]?.price?.id ?? "";
        const resolvedPlan = renewedPriceId
          ? resolvePlanFromPriceId(renewedPriceId)
          : dbSub.plan;

        await serviceSupabase
          .from("subscriptions")
          .update({
            status: "active",
            plan: resolvedPlan,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", dbSub.user_id);

        // Ensure profiles.plan is in sync with the resolved plan
        await serviceSupabase
          .from("profiles")
          .update({ plan: resolvedPlan })
          .eq("id", dbSub.user_id);

        console.log(JSON.stringify({ fn: 'stripe-webhook', msg: 'invoice.paid: period updated', userId: dbSub.user_id }));
        break;
      }

      // T2: Grace period — downgrade to free on 3rd failed attempt
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id || "";
        if (!customerId) break;

        const { data: dbSub } = await serviceSupabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!dbSub?.user_id) break;

        const attemptCount = invoice.attempt_count ?? 1;
        const newPlan = attemptCount >= 3 ? "free" : undefined;

        const updateData: Record<string, unknown> = {
          status: "past_due",
          updated_at: new Date().toISOString(),
        };
        if (newPlan) {
          updateData.plan = newPlan;
        }

        await serviceSupabase
          .from("subscriptions")
          .update(updateData)
          .eq("user_id", dbSub.user_id);

        if (newPlan) {
          await serviceSupabase
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", dbSub.user_id);

          console.log(JSON.stringify({
            fn: 'stripe-webhook',
            msg: 'invoice.payment_failed: user downgraded after 3 attempts',
            userId: dbSub.user_id,
            attemptCount,
          }));
        }
        break;
      }

      default:
        console.log(JSON.stringify({ fn: 'stripe-webhook', msg: 'unhandled event', eventType: event.type }));
    }
  } catch (err) {
    console.error(JSON.stringify({ fn: 'stripe-webhook', level: 'error', msg: 'handler error', error: String(err) }));
    return new Response(String(err), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
