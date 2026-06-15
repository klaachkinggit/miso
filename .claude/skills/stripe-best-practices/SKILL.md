---
name: stripe-best-practices
description: Stripe integration decisions for payments, Checkout Sessions, PaymentIntents, Connect, billing, webhooks, security, and API migrations.
---

# Stripe Best Practices

Use for any Stripe code or design.

## Decide API

- Hosted Checkout for simple hosted flows.
- PaymentIntents/Payment Element for custom checkout.
- Connect for marketplaces/platforms.
- Billing for subscriptions/invoices.

## Connect

- Model connected accounts separately from platform users.
- Use explicit account/controller properties.
- Treat onboarding/account status as external state.
- Handle transfers, refunds, disputes, and account updates idempotently.

## Security

- Never expose secret keys.
- Verify webhooks with raw body + endpoint secret.
- Store Stripe IDs, not card data.
- Use idempotency keys for create/mutate calls.
- Log event IDs and processing status.

## Migration

Check current API version and SDK behavior before changing. Prefer official Stripe docs for exact fields.
