-- Multi-item primary checkout records one purchase per ticket. All purchases in
-- one checkout share the same idempotency/provider session key.
alter table purchases drop constraint if exists purchases_stripe_checkout_session_id_key;
alter table purchases drop constraint if exists purchases_provider_session_id_key;
