-- V2 continuation: resale buyer fee snapshots + off-platform wallet export ops.

alter table resale_listings
  add column if not exists platform_fee_amount numeric(12,2) not null default 0
    check (platform_fee_amount >= 0),
  add column if not exists buyer_total_amount numeric(12,2)
    check (buyer_total_amount is null or buyer_total_amount >= price);

create table if not exists resale_seller_settlements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references resale_listings(id) on delete cascade,
  seller_user_id uuid not null references profiles(id),
  amount numeric(12,2) not null check (amount >= 0),
  currency currency not null,
  status text not null default 'pending_payout'
    check (status in ('pending_payout','paid','failed')),
  provider_transfer_id text,
  created_at timestamptz not null default now()
);

alter table resale_seller_settlements enable row level security;

create policy "settlements_admin_all" on resale_seller_settlements
  for all using (public.has_role(array['admin']::user_role[]));

create policy "settlements_seller_select" on resale_seller_settlements
  for select using (seller_user_id = auth.uid());

-- Existing 0013 check constraints only allow mint/transfer. Relax them so a
-- wallet export can reuse the same idempotent chain_ops machinery without a
-- resale listing.
alter table chain_ops drop constraint if exists chain_ops_op_type_check;
alter table chain_ops add constraint chain_ops_op_type_check
  check (op_type in ('mint','transfer','wallet_export'));

alter table chain_ops drop constraint if exists chain_ops_check;
alter table chain_ops add constraint chain_ops_check
  check (
    (op_type = 'mint' and purchase_id is not null and listing_id is null) or
    (op_type = 'transfer' and listing_id is not null and purchase_id is null) or
    (op_type = 'wallet_export' and purchase_id is null and listing_id is null)
  );

create unique index if not exists chain_ops_wallet_export_live_uniq
  on chain_ops(ticket_id)
  where op_type = 'wallet_export'
    and status in ('queued','sent','mined','repair_needed');
