# ADR-0006 — Multi-Item Provider Session Keys

- **Status:** Proposed
- **Date:** 2026-06-21
- **Deciders:** Miso maintainers

## Context

Multi-item primary checkout records one `purchases` row per ticket and links those rows to one `marketplace_payments` row through `marketplace_payment_items`. The older `purchases.provider_session_id` unique constraint came from the pre-marketplace Stripe Checkout Session model, where one checkout created one purchase. Keeping that uniqueness makes a valid multi-item checkout fail when all item purchases share the same idempotency/provider session key.

## Decision

`purchases.provider_session_id` is not unique; multi-item grouping belongs to `marketplace_payment_items`.

- Drop the legacy unique constraint under both historical names.
- Keep writing the same idempotency/provider session key to all purchases in one checkout.
- Keep payment-level reconciliation on `marketplace_payments` and item membership in `marketplace_payment_items`.

## Alternatives Considered

- **Store the provider session key only on the first purchase —** rejected because replay/free-claim lookup would no longer recover every item purchase from the shared checkout.
- **Synthesize per-item provider session keys —** rejected because it changes the meaning of the provider key and makes idempotency harder to reason about.
- **Move the provider key only to `marketplace_payments` —** rejected for this patch because legacy purchase-level lookup still exists and needs a separate migration path.

## Consequences

- Upside: valid multi-item paid and free checkouts no longer violate the old one-purchase constraint.
- Upside: idempotency remains a checkout-level value across all item purchases.
- Cost we're accepting: purchase-level `provider_session_id` can no longer be used as a unique identifier.
- Cost we're accepting: callers must use `marketplace_payment_items` when they need exact item membership.
- Reversibility: medium; restoring uniqueness would require a new provider-session model or a data cleanup.

## Links

- Related ADR: ADR-0002
- Handoff: docs/handoffs/2026-06-20-audit-pass-1.md
