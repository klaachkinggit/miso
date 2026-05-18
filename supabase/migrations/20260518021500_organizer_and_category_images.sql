-- Adds per-category artwork (image_url + IPFS pin) so each tier's NFT can use
-- distinct metadata, and extends profiles with Stripe Connect + organizer
-- onboarding state used by the split signup flow.

alter table ticket_categories
  add column if not exists image_url text,
  add column if not exists image_ipfs_uri text;

alter table profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists organizer_onboarding jsonb;

create unique index if not exists profiles_stripe_account_idx
  on profiles(stripe_account_id)
  where stripe_account_id is not null;
