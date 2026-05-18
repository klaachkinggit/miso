alter table purchases
  add column if not exists checkout_idempotency_key text;

create unique index if not exists purchases_buyer_checkout_idempotency_key_idx
  on purchases (buyer_user_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;
