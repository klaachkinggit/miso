# ADR-0008 - Cumulative Marketplace Refund Accounting

- **Status:** Accepted
- **Date:** 2026-06-21
- **Deciders:** Miso maintainers

## Context

Marketplace refunds can be initiated inside Miso or externally in Stripe. Stripe `charge.refunded` events report a cumulative refunded amount on the Charge, while each embedded Refund object is only one refund attempt. The existing implementation treated the first embedded refund as the whole refund and stored only one transfer reversal id, so repeated partial refunds could over-reverse, under-reverse, or leave linked tickets and purchases in paid/sold states after a full refund.

## Decision

Track cumulative transfer reversal progress per marketplace transfer and finalize linked purchase/ticket lifecycle only when the cumulative refund covers the non-fee refundable amount.

- Add `marketplace_transfers.reversed_amount_cents` and `marketplace_transfers.stripe_transfer_reversal_ids`.
- Keep `stripe_transfer_reversal_id` as the latest reversal id for existing UI/tests.
- Use Stripe Charge `amount_refunded` as the external refund target and reverse only the delta not already recorded locally.
- Use refund-aware reversal idempotency keys so separate partial refunds can create separate Stripe transfer reversals.
- On full primary refunds, mark every linked purchase refunded and every linked ticket refunded; on resale refunds, refund the ticket while preserving the sold listing history.

## Alternatives Considered

- **Use only Stripe refund IDs in audit metadata** - rejected because audit logs are not a queryable source of truth for idempotent reversal planning.
- **Create a separate `marketplace_transfer_reversals` table** - rejected for now because the current UI and refund code only need cumulative amount plus reversal ids; a child table can be added later if detailed reversal reporting becomes product-facing.
- **Add a `refunded` resale listing status** - rejected because the listing enum and product history model do not include it; the sale remains historical while the ticket is refunded.

## Consequences

- Upside: repeated partial external refunds are idempotent against local reversal accounting.
- Upside: full refunds no longer leave primary purchases or tickets in paid/sold states.
- Cost we're accepting: transfer rows now carry denormalized cumulative reversal data.
- Cost we're accepting: external Stripe refunds still rely on webhook delivery to sync local lifecycle rows.
- Reversibility: moderate; the migration is additive, but existing reversed transfer rows are backfilled as fully reversed.

## Links

- Related ADR: ADR-0001
- Related ADR: ADR-0002
