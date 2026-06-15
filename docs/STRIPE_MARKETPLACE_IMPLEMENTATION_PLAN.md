# Stripe Marketplace Implementation Plan

> **Status (2026-06-15): implemented.** The marketplace payment system (separate charges and transfers) is live; the legacy stored-value checkout was decommissioned (ADR 0003). Any "open choices" below are resolved — see ADRs 0001–0003 and the code in `src/lib/stripe-marketplace/`. Kept as historical design context.

This plan is the handoff source for replacing Miso's legacy stored-value checkout with direct Stripe marketplace settlement. Domain terms are defined in [CONTEXT.md](./CONTEXT.md). The implementation branch is `stripe-europe-cash-in-out`.

## Decisions

- Miso is direct P2P marketplace settlement only; no buyer top-up wallet or in-app stored-value checkout.
- Historical stored-value ledger tables may remain in the database as audit/backward-compatible data, but app flows must not use them.
- Stripe v1 supports `EUR` card payments only.
- `MAD` prices may be drafted/configured, but `MAD` publish and checkout remain unavailable.
- Stripe charge type is separate charges and transfers, not destination charges.
- One checkout contains one item. Primary checkout is Buyer to Organizer. Resale checkout is Buyer to Holder, optionally with Organizer royalty.
- Miso takes a platform-configured Marketplace fee, initially `5%`, calculated from gross price.
- Organizer resale royalty is implemented in v1, enabled, default `0%`, organizer-configured per event, calculated from gross resale price.
- On resale, seller proceeds equal gross price minus Marketplace fee minus Organizer resale royalty.
- Seller transfers are created only after Stripe confirms card payment success through webhooks.
- Ticket mint or transfer is attempted before seller transfers. If fulfillment is pending or repair-needed, funds remain on the platform.
- Refunds are manual admin decisions. Buyer refund amounts exclude Miso's Marketplace fee. Organizer royalty is seller proceeds and can be reversed/refunded.
- Seller risk status is operational only; do not build user-facing negative balance UI.
- Sellers with blocked or unresolved recovery risk cannot publish paid EUR inventory.

## Data Model

Add or update schema with a forward-only migration.

- Extend `currency` enum to include `EUR`.
- Extend `user_role` enum to include `organizer`.
- Add `events.organizer_user_id references profiles(id)`.
- Add `events.organizer_resale_royalty_bps int not null default 0`.
- Add constraints so royalty basis points are between `0` and a chosen max. Recommended max for v1: `5000` basis points until product sets a stricter business rule.
- Remove or replace MAD-only constraints from `ticket_categories`, `purchases`, and `resale_listings`.
- Add seller Stripe state to profiles or a dedicated table. Recommended table: `stripe_seller_accounts`.
- Add `seller_risk_status` enum: `clear`, `restricted`, `owes_recovery`, `blocked`.
- Add shared `marketplace_payments` table linking to exactly one `purchase_id` or `resale_listing_id`.
- Add `marketplace_transfers` table for each connected-account transfer created from a marketplace payment.

Recommended `marketplace_payments` fields:

- `id`
- `kind`: `primary` or `resale`
- `buyer_user_id`
- `primary_seller_user_id`
- `organizer_user_id`
- `purchase_id nullable`
- `resale_listing_id nullable`
- `amount_total`
- `currency`
- `marketplace_fee_bps`
- `marketplace_fee_amount`
- `organizer_royalty_bps`
- `organizer_royalty_amount`
- `primary_seller_amount`
- `stripe_payment_intent_id unique`
- `stripe_charge_id`
- `stripe_transfer_group unique`
- `status`: `requires_payment`, `processing`, `succeeded`, `fulfillment_pending`, `transfers_pending`, `paid`, `failed`, `refund_pending`, `refunded`, `disputed`, `repair_needed`
- webhook timestamps and failure reason fields

Recommended `marketplace_transfers` fields:

- `id`
- `marketplace_payment_id`
- `recipient_user_id`
- `recipient_role`: `organizer`, `resale_seller`
- `amount`
- `currency`
- `stripe_connected_account_id`
- `stripe_transfer_id unique`
- `stripe_transfer_reversal_id nullable`
- `status`: `pending`, `created`, `reversed`, `failed`

## Stripe Seller Onboarding

- Create Stripe Connect accounts for organizers and resale sellers with Accounts v2/controller settings where supported by the installed Stripe SDK.
- Use Express-style Stripe-hosted onboarding/account links.
- Store Stripe account id, `charges_enabled`, `payouts_enabled`, requirements/disabled reason, and seller risk status.
- Handle `account.updated` webhooks to refresh seller readiness.
- Allow drafting events/listings before onboarding.
- Block publishing paid EUR inventory unless the seller has a Connect account, `charges_enabled = true`, `payouts_enabled = true`, risk status `clear`, and price greater than zero.

## Checkout Flow

Primary checkout:

1. Buyer chooses an EUR category.
2. Server verifies event is published, organizer is payout-ready, seller risk is clear, and currency is EUR.
3. Reserve the ticket and create a `purchases` row.
4. Create `marketplace_payments` with computed fee amounts.
5. Create Stripe PaymentIntent on platform account in EUR with `transfer_group`; omit `payment_method_types` so Stripe dynamic payment methods can apply.
6. Return client secret or redirect through the chosen Stripe UI.

Resale checkout:

1. Buyer chooses an active EUR resale listing.
2. Server verifies resale seller is payout-ready, organizer is payout-ready when royalty is greater than zero, seller risk states are clear, and currency is EUR.
3. Claim/listing lock uses existing transfer-safe status model.
4. Create `marketplace_payments` with marketplace fee, organizer royalty, and resale seller amount.
5. Create Stripe PaymentIntent on platform account in EUR with `transfer_group`; omit `payment_method_types` so Stripe dynamic payment methods can apply.

Blocked flows:

- `MAD` checkout returns a clear server-side error: `MAD payments are not available yet.`
- Legacy stored-value charge/cashout routes are removed from navigation and app code.

## Webhook Flow

Listen for these Stripe events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`
- `account.updated`

On `payment_intent.succeeded`:

1. Verify signature.
2. Find `marketplace_payments` by PaymentIntent id.
3. Idempotently lock/claim processing.
4. Persist `stripe_charge_id`.
5. Attempt ticket fulfillment first:
   - Primary: mint/fulfill reserved ticket.
   - Resale: transfer NFT from seller to buyer.
6. If fulfillment is uncertain, mark buyer-facing `fulfillment_pending` and admin-facing `repair_needed` when needed. Do not create transfers.
7. If fulfillment is confirmed, create Stripe transfers with `source_transaction = charge_id` and `transfer_group`.
8. Mark payment/order/listing as paid or sold after transfers are recorded.

On `payment_intent.payment_failed`:

- Mark marketplace payment failed.
- Release primary reservation or resale claim if no payment succeeded.
- Do not fulfill or transfer.

On `account.updated`:

- Refresh seller readiness.
- Mark seller `restricted` when Stripe disables charges or payouts.
- Block future EUR publishing while restricted.

On disputes:

- Mark payment disputed.
- Mark related seller risk status for admin review if needed.
- Do not auto-refund or auto-reverse unless a future policy explicitly adds it.

## Manual Refunds

- Admin-only.
- Marketplace fee is not refunded to the buyer.
- Organizer resale royalty and resale seller proceeds are refundable/reversible seller proceeds.
- If transfers were already created, attempt transfer reversals for the refundable seller proceeds before or as part of refund handling.
- If recovery fails, mark seller risk status `owes_recovery` or `blocked`.
- If no transfers were created because fulfillment is pending, refund only the refundable portion directly from platform-held funds.

## UI Work

- Remove stored-value wallet pages from primary nav and buyer purchase UI.
- Change event checkout copy to Stripe card/payment-element checkout.
- Add organizer role onboarding path.
- Add seller Stripe onboarding/status panel for organizers and resale sellers.
- Add organizer event field for resale royalty percentage, default `0`.
- Gate publish buttons with payout readiness and risk status.
- Show buyer-facing `fulfillment_pending` instead of `repair_needed`.
- Add admin/support view for repair-needed payments, Stripe ids, chain ops, retries, refund actions, and seller risk controls.

## Environment

Expected env vars:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `MISO_MARKETPLACE_FEE_BPS`, default `500`
- existing Supabase and Thirdweb env vars

## Tests

Add focused tests for:

- EUR primary checkout creates PaymentIntent and marketplace payment.
- MAD primary checkout is rejected.
- EUR resale checkout computes marketplace fee, organizer royalty, and seller proceeds correctly.
- `payment_intent.succeeded` fulfills before transfers.
- webhook idempotency prevents duplicate fulfillment/transfers.
- fulfillment pending does not transfer seller funds.
- manual refund excludes marketplace fee.
- seller risk blocked prevents publishing.
- organizer missing payout readiness prevents EUR publish.

## Open Implementation Choices

- Whether checkout UI uses Stripe Payment Element or Stripe Checkout. Recommended: Payment Element if the app wants embedded control; Checkout if speed and hosted compliance are more important.
- Exact maximum organizer royalty percentage.
- Whether free tickets bypass Stripe entirely. Recommended: free EUR/MAD tickets can be minted without Stripe, but require a separate explicit product decision.
