# Multi-Item Primary Marketplace Payments

Miso extends marketplace primary checkout from one item per checkout to multiple items, superseding the implementation plan's "one checkout contains one item" decision for the primary flow only. Resale checkout stays single-item: a listing is one ticket by nature.

The storefront sells quantity 1–10, gift tickets, and club-table extra guests through the legacy Checkout Session stack. Keeping the marketplace path single-item would either regress those live features or freeze the legacy stack in place forever. Multi-item primary payments let the buy button move to marketplace rails and the legacy stack be decommissioned.

Shape of the change:

- One `marketplace_payments` row per checkout, one Stripe PaymentIntent for the summed buyer total. A new `marketplace_payment_items` table links the payment to its purchases (one purchase per ticket, preserving the legacy purchase-per-ticket model so tickets, gate, analytics, and refund surfaces keep working unchanged). Existing single-item rows are backfilled into items; `marketplace_payments.purchase_id` becomes legacy-read-only and is null on new primary payments.
- Per-item gross amounts live on the items rows; the marketplace fee is computed on the summed gross exactly as before. Buyer pricing follows the marketplace model (fee inside gross, per ADR 0001 and the implementation plan), not the legacy add-on service fee — the buy dialog changes to match.
- Fulfillment is all-or-nothing at the payment level: the state machine is unchanged, every item must mint/transfer before connected-account transfers fire, and any item failure parks the whole payment in `repair_needed`. Per-item partial settlement is explicitly out of scope for v1.
- Refunds stay manual, admin-driven, and payment-level in v1; refunding a payment releases or refunds all of its items.
- Checkout idempotency moves off the single-purchase lookup: all purchases of a checkout carry the idempotency key in `provider_session_id`, and the payment is resolved through the items table.
