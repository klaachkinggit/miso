alter table resale_listings
  add column if not exists checkout_idempotency_key text;

create unique index if not exists resale_listings_buyer_checkout_idempotency_key_idx
  on resale_listings (buyer_user_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;
