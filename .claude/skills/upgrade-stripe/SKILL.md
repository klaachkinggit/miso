---
name: upgrade-stripe
description: Upgrade Stripe API versions and SDKs.
---

# Upgrade Stripe

Default target: Stripe API `2026-04-22.dahlia` unless user specifies another.

## Flow

1. Identify current API version, SDK versions, webhook endpoints, and Stripe surfaces used.
2. Read official Stripe changelog for each version jump.
3. Upgrade SDKs first in smallest safe step.
4. Update API-version-sensitive fields and webhook event handling.
5. Verify webhook signatures, idempotency, refunds/disputes, Connect account events.
6. Run tests/build. Add tests for changed payload shape.

## Rules

- Do not silently change production account API version.
- Keep webhook endpoint versions explicit.
- Never expose or rotate keys casually.
- For Connect, check platform + connected-account behavior.
