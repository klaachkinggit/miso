alter table resale_listings
  add column if not exists stripe_fee_amount numeric(12,2) not null default 0
    check (stripe_fee_amount >= 0);
