-- Migration 0013 — chain_ops table.
--
-- Records "in-flight" mint/transfer ops BEFORE the chain call so that a
-- retry resumes the exact same Thirdweb transactionId rather than
-- re-broadcasting under a different idempotency key. Together with the
-- new `minting`/`transferring` ticket+listing states this prevents:
--   - timeout-then-retry double-mints
--   - parallel buyers both passing an `active`-status read on the same
--     resale listing
--   - reservation-release followed by another buyer reusing the same
--     idempotency key
--
-- Idempotency contract:
--   * mint     op  → idempotency_key = 'mint:' || purchase_id
--   * transfer op  → idempotency_key = 'transfer:' || listing_id || ':' || attempt
--   The unique index on (purchase_id) WHERE op_type='mint' guarantees one
--   live mint row per purchase; same for (listing_id) where op_type='transfer'
--   and status is not 'errored'. An errored row may be superseded by a
--   higher-attempt row, so the compensated buyer can retry under a fresh key.

create table if not exists chain_ops (
  id uuid primary key default gen_random_uuid(),
  op_type text not null check (op_type in ('mint','transfer')),

  purchase_id uuid references purchases(id) on delete cascade,
  listing_id  uuid references resale_listings(id) on delete cascade,
  ticket_id   uuid not null references tickets(id) on delete cascade,

  contract_address text not null,
  token_id bigint not null,
  from_address text,
  to_address text not null,

  idempotency_key text not null unique,
  transaction_id text,
  tx_hash text,
  metadata_uri text,

  status text not null default 'queued'
    check (status in ('queued','sent','mined','errored','repair_needed')),
  attempt integer not null default 1,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Exactly one of purchase_id / listing_id depending on op_type.
  check (
    (op_type = 'mint'     and purchase_id is not null and listing_id is null) or
    (op_type = 'transfer' and listing_id  is not null and purchase_id is null)
  )
);

-- Touch updated_at on UPDATE.
create trigger chain_ops_touch before update on chain_ops
  for each row execute function touch_updated_at();

create index if not exists chain_ops_purchase_idx on chain_ops(purchase_id)
  where purchase_id is not null;
create index if not exists chain_ops_listing_idx on chain_ops(listing_id)
  where listing_id is not null;
create index if not exists chain_ops_ticket_idx on chain_ops(ticket_id);

-- One live op per purchase / listing. Errored rows are excluded so a
-- compensated buyer can re-enter with attempt=2 under a fresh key.
create unique index if not exists chain_ops_mint_live_uniq
  on chain_ops(purchase_id)
  where op_type = 'mint' and status in ('queued','sent','mined','repair_needed');
create unique index if not exists chain_ops_transfer_live_uniq
  on chain_ops(listing_id)
  where op_type = 'transfer' and status in ('queued','sent','mined','repair_needed');

-- ===== RLS: service-role only ==============================================
alter table chain_ops enable row level security;

create policy "chain_ops_admin_all" on chain_ops
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
