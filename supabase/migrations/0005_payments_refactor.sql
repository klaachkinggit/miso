-- Migration 0005 — Payments abstraction + refund_pending status.
--
-- 1. Add 'refund_pending' to ticket_status enum.
-- 2. Make purchases/resale_listings provider-agnostic (was Stripe-specific).
--    Renames stripe_checkout_session_id → provider_session_id,
--             stripe_payment_intent_id  → provider_payment_id.
--    Adds payment_provider text column.

alter type ticket_status add value if not exists 'refund_pending';

alter table purchases
  rename column stripe_checkout_session_id to provider_session_id;
alter table purchases
  rename column stripe_payment_intent_id to provider_payment_id;
alter table purchases
  add column if not exists payment_provider text;

alter table resale_listings
  rename column stripe_checkout_session_id to provider_session_id;
alter table resale_listings
  add column if not exists payment_provider text;
