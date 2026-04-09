# Stripe Webhook — Production Checklist

## 1. Stripe Dashboard → Developers → Webhooks

- [ ] Endpoint registered: `https://bbalunqbiwkvvvcnjmsh.supabase.co/functions/v1/stripe-webhook`
- [ ] Events subscribed (select all):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- [ ] Copy the **Signing Secret** (`whsec_...`) from the endpoint

## 2. Secrets Configuration

Ensure these secrets are set in Lovable Cloud:

| Secret | Example | Status |
|--------|---------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | ✅ Set |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | ✅ Set |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_...` | ✅ Set |
| `STRIPE_PRICE_PRO_QUARTERLY` | `price_...` | ✅ Set |
| `STRIPE_PRICE_PRO_SEMIANNUAL` | `price_...` | ✅ Set |
| `STRIPE_PRICE_PRO_ANNUAL` | `price_...` | ✅ Set |
| `STRIPE_PRICE_TEAM_MONTHLY` | `price_...` | ✅ Set |
| `STRIPE_PRICE_TEAM_QUARTERLY` | `price_...` | ✅ Set |
| `STRIPE_PRICE_TEAM_SEMIANNUAL` | `price_...` | ✅ Set |
| `STRIPE_PRICE_TEAM_ANNUAL` | `price_...` | ✅ Set |

## 3. Post-Deploy Sanity Check

```bash
# Test with Stripe CLI:
stripe listen --forward-to https://bbalunqbiwkvvvcnjmsh.supabase.co/functions/v1/stripe-webhook

# Trigger test events:
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

Verify in edge function logs that each event returned HTTP 200 and the expected log appeared.

## 4. Event Handling Summary

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Creates/updates subscription, sets plan to active |
| `customer.subscription.updated` | Syncs plan, billing cycle, period dates, `cancel_at_period_end` |
| `customer.subscription.deleted` | Downgrades to free, resets `cancel_at_period_end` |
| `invoice.paid` | Updates `current_period_end`, reactivates from `past_due` |
| `invoice.payment_failed` | Sets `past_due`; downgrades to free on 3rd+ attempt |
