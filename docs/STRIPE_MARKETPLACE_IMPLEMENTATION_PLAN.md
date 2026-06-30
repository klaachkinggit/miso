# Stripe Marketplace Implementation Plan

Historical plan. The marketplace payment system is implemented and the legacy stored-value checkout is decommissioned.

Current sources of truth:

- Domain terms: `docs/CONTEXT.md`
- Decisions: `docs/adr/0001-stripe-separate-charges-and-transfers.md`, `docs/adr/0002-multi-item-primary-marketplace-payments.md`, `docs/adr/0003-legacy-checkout-decommission-and-free-claims.md`, `docs/adr/0008-cumulative-marketplace-refund-accounting.md`
- Runtime code: `src/lib/stripe-marketplace/`, `src/app/checkout/card/`, `src/app/api/stripe-marketplace/`
- Deployment/runbook: `docs/ci-and-deploy.md`

Settled constraints:

- Stripe uses separate charges and transfers.
- Buyer checkout is card-first on marketplace rails; no stored-value wallet checkout.
- Fulfillment happens before seller transfers.
- Manual refunds reverse refundable seller proceeds and exclude the marketplace fee from buyer refunds.
- Paid publish/checkout remains gated by seller payout readiness and supported currency.
