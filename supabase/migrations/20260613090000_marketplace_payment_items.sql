-- ADR 0002: multi-item primary marketplace payments.
-- Creates marketplace_payment_items, backfills existing primary rows,
-- and relaxes the XOR constraint so new primary payments set purchase_id
-- to null (items table is the canonical link).

-- ===== marketplace_payment_items ============================================
create table if not exists marketplace_payment_items (
  id                    uuid        primary key default gen_random_uuid(),
  marketplace_payment_id uuid       not null
    references marketplace_payments(id) on delete cascade,
  purchase_id           uuid        not null unique
    references purchases(id),
  amount_cents          int         not null check (amount_cents >= 0),
  created_at            timestamptz not null default now()
);

create index if not exists marketplace_payment_items_payment_idx
  on marketplace_payment_items(marketplace_payment_id);

-- Service-role only: mirror RLS posture of sibling marketplace tables.
alter table marketplace_payment_items enable row level security;
revoke all on marketplace_payment_items from anon, authenticated;

-- ===== Backfill existing primary payments ===================================
insert into marketplace_payment_items
  (marketplace_payment_id, purchase_id, amount_cents)
select
  id,
  purchase_id,
  amount_total_cents::int
from marketplace_payments
where kind = 'primary'
  and purchase_id is not null
on conflict (purchase_id) do nothing;

-- ===== Relax the XOR constraint =============================================
-- Drop the old constraint that required primary rows to carry purchase_id.
-- New primary payments set purchase_id = null; items table is the link.
-- Resale rows are unchanged: resale_listing_id not null, purchase_id null.
alter table marketplace_payments
  drop constraint marketplace_payments_exactly_one_target;

alter table marketplace_payments
  add constraint marketplace_payments_exactly_one_target check (
    (kind = 'resale' and resale_listing_id is not null and purchase_id is null)
    or (kind = 'primary' and resale_listing_id is null)
  );
