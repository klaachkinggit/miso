# PayZone Integration — Production Setup

Miso ships with two payment providers behind a single `PaymentProvider`
interface (`src/lib/payments/provider.ts`):

- **`mock`** — `MockPaymentProvider` (free demo, no network, no costs).
- **`payzone`** — `PayzoneProvider` (live Moroccan card processor).

For the free demo nothing in this file applies. Set `PAYMENT_PROVIDER=mock`
(the default when `MISO_DEMO_MODE=true`) and you're done.

## Step 1 — Merchant onboarding

1. Sign the PayZone Maroc merchant agreement. PayZone issues:
   - A **merchant ID** (UUID-like string).
   - A **REST API key** (used as a Bearer token).
   - An **HMAC secret** (used to sign every request body and to verify the
     signature on every incoming webhook). Keep this off the client side.
2. Choose the **Hosted Payment Page (HPP)** product. The current
   `PayzoneProvider` integrates against the HPP flow:
   - Backend → `POST /checkout/sessions` → returns a `redirect_url` for the buyer.
   - Buyer enters card details on the PayZone-hosted page.
   - PayZone posts asynchronous status updates to our `notification_url`.

## Step 2 — Environment variables

Set these in `.env.local` (or your hosting provider's secret manager):

```bash
PAYMENT_PROVIDER=payzone

PAYZONE_API_BASE=https://api.payzone.ma/v1
PAYZONE_MERCHANT_ID=...
PAYZONE_API_KEY=...
PAYZONE_HMAC_SECRET=...
```

Leave `MISO_DEMO_MODE` unset (or `false`) so the real Solana mint runs.

## Step 3 — Webhook endpoint

Register `https://<your-domain>/api/webhooks/payments` as the notification URL
in the PayZone merchant dashboard. The handler:

1. Reads the raw request body and the `x-signature` header.
2. Recomputes `HMAC-SHA256(body, PAYZONE_HMAC_SECRET)` and rejects mismatches
   with HTTP 400. This is checked in constant time (`timingSafeEqual`).
3. Dispatches the event by type:
   - `payment.succeeded` → mints the ticket NFT + flips purchase to `paid`.
   - `payment.failed` / `payment.expired` → releases the reservation, marks
     purchase `failed`.
   - `refund.succeeded` → reconciles purchase if PayZone initiated the refund.
4. Records the PayZone `event_id` in `audit_logs` for idempotency, so PayZone
   can safely retry without double-processing.

## Step 4 — Field names

`PayzoneProvider` assumes the following request/response shape (matches the
public Payzone Maroc HPP docs at time of writing):

```jsonc
// POST /checkout/sessions
{
  "merchant_id": "...",
  "order_id": "<our purchase.id>",
  "amount": 25000,              // minor units (centimes)
  "currency": "MAD",
  "customer_email": "...",
  "description": "Event — Category",
  "return_url": "https://app/checkout/success?purchase_id=...",
  "cancel_url": "https://app/checkout/cancel?...",
  "notification_url": "https://app/api/webhooks/payments",
  "metadata": { "purchase_id": "...", "ticket_id": "...", "buyer_user_id": "...", "event_id": "..." }
}

// 200 OK
{
  "session_id": "...",
  "redirect_url": "https://pay.payzone.ma/..."
}
```

```jsonc
// Webhook payload
{
  "event_id": "...",
  "event_type": "payment.succeeded",
  "session_id": "...",
  "payment_id": "...",
  "metadata": { "purchase_id": "..." }
}
```

If PayZone's actual field names differ in your merchant kit (e.g. `transaction_id`
instead of `payment_id`), patch `src/lib/payments/payzone.ts` —
`createCheckout`, `parseWebhook` and `refund` are the only three places that
need updating.

## Step 5 — Test against staging

1. Use PayZone's sandbox base URL (set `PAYZONE_API_BASE` to the sandbox host).
2. Issue a checkout with one of PayZone's test PANs.
3. Verify in the merchant dashboard that the webhook fires.
4. Tail the app logs: you should see `payments webhook` audit entries and the
   purchase flipping to `paid`.

## Step 6 — Go live

1. Swap `PAYZONE_API_BASE` to production.
2. Re-issue production credentials.
3. Confirm `MISO_DEMO_MODE` is unset (otherwise the real Solana mint is
   skipped and tickets remain non-collectible).
4. Smoke-test one real card transaction, then refund it from the admin UI to
   verify the refund leg of the integration.
