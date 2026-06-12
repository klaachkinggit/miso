-- Stripe marketplace: seller accounts, marketplace payments, marketplace
-- transfers.
--
-- Implements ADR 0001 (separate charges and transfers): one card
-- payment lands on the platform account; one or more connected-account
-- transfers move proceeds to the Organizer, the resale Holder, and
-- optionally the Organizer royalty recipient AFTER ticket fulfillment.
--
-- All three new tables are service-role only. There is no client-side
-- access pattern; the Next.js API routes read/write via the service
-- client and surface what the buyer/seller needs through server
-- components and API responses.

-- ===== Events: organizer + resale royalty ==================================
-- events.organizer_user_id and its index already exist (see
-- 20260518100836_organizer_event_scoping); only the royalty column is new.
alter table events
  add column if not exists organizer_user_id uuid
    references profiles(id) on delete set null,
  add column if not exists organizer_resale_royalty_bps int not null default 0;

alter table events
  drop constraint if exists events_organizer_resale_royalty_bps_range,
  add constraint events_organizer_resale_royalty_bps_range
    check (organizer_resale_royalty_bps between 0 and 5000);

-- ===== New enums ============================================================
do $$ begin
  create type seller_risk_status as enum (
    'clear', 'restricted', 'owes_recovery', 'blocked'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type marketplace_payment_kind as enum ('primary', 'resale');
exception when duplicate_object then null; end $$;

do $$ begin
  create type marketplace_payment_status as enum (
    'requires_payment',
    'processing',
    'succeeded',
    'fulfillment_pending',
    'transfers_pending',
    'paid',
    'failed',
    'refund_pending',
    'refunded',
    'disputed',
    'repair_needed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type marketplace_transfer_recipient_role as enum (
    'organizer', 'resale_seller'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type marketplace_transfer_status as enum (
    'pending', 'created', 'reversed', 'failed'
  );
exception when duplicate_object then null; end $$;

-- ===== stripe_seller_accounts ==============================================
-- One row per seller (organizer or resale holder) connected to Stripe.
-- We do NOT store bank details; Stripe Connect owns onboarding and
-- payouts. We mirror payout readiness and risk status only.
create table if not exists stripe_seller_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  disabled_reason text,
  requirements_json jsonb,
  seller_risk_status seller_risk_status not null default 'clear',
  last_webhook_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stripe_seller_accounts_user_idx
  on stripe_seller_accounts(user_id);
create trigger stripe_seller_accounts_touch
  before update on stripe_seller_accounts
  for each row execute function touch_updated_at();

-- ===== marketplace_payments ================================================
-- Canonical state machine for one buyer-to-seller(s) settlement.
-- Linked to exactly one purchases row (primary) OR one resale_listings
-- row (resale). All money fields are stored as cents (smallest currency
-- unit) to avoid floating-point drift on bps calculations.
create table if not exists marketplace_payments (
  id uuid primary key default gen_random_uuid(),
  kind marketplace_payment_kind not null,

  buyer_user_id uuid not null references profiles(id),
  primary_seller_user_id uuid not null references profiles(id),
  organizer_user_id uuid references profiles(id),

  purchase_id uuid references purchases(id) on delete set null,
  resale_listing_id uuid references resale_listings(id) on delete set null,

  amount_total_cents bigint not null check (amount_total_cents > 0),
  currency currency not null,

  marketplace_fee_bps int not null check (marketplace_fee_bps between 0 and 10000),
  marketplace_fee_cents bigint not null check (marketplace_fee_cents >= 0),

  organizer_royalty_bps int not null default 0
    check (organizer_royalty_bps between 0 and 10000),
  organizer_royalty_cents bigint not null default 0
    check (organizer_royalty_cents >= 0),

  primary_seller_cents bigint not null check (primary_seller_cents >= 0),

  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_group text unique,

  status marketplace_payment_status not null default 'requires_payment',
  failure_reason text,

  succeeded_at timestamptz,
  fulfilled_at timestamptz,
  transferred_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  last_webhook_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_payments_currency_eur_only
    check (currency = 'EUR'),

  constraint marketplace_payments_exactly_one_target
    check (
      (kind = 'primary' and purchase_id is not null and resale_listing_id is null)
      or (kind = 'resale' and resale_listing_id is not null and purchase_id is null)
    ),

  constraint marketplace_payments_amount_split
    check (
      marketplace_fee_cents + organizer_royalty_cents + primary_seller_cents
        = amount_total_cents
    ),

  -- Royalty cents > 0 requires an organizer_user_id to receive them,
  -- otherwise the funds would be stranded on the platform with no
  -- transfer recipient.
  constraint marketplace_payments_royalty_needs_organizer
    check (organizer_royalty_cents = 0 OR organizer_user_id IS NOT NULL)
);

-- Block double-active marketplace payments for the same purchase or
-- listing. Failed/refunded rows do not count, so a retry path can
-- always create a fresh attempt without DROP-and-recreate gymnastics.
create unique index if not exists marketplace_payments_purchase_live_uniq
  on marketplace_payments(purchase_id)
  where purchase_id is not null
    and status in (
      'requires_payment','processing','succeeded','fulfillment_pending',
      'transfers_pending','paid','repair_needed','refund_pending','disputed'
    );
create unique index if not exists marketplace_payments_listing_live_uniq
  on marketplace_payments(resale_listing_id)
  where resale_listing_id is not null
    and status in (
      'requires_payment','processing','succeeded','fulfillment_pending',
      'transfers_pending','paid','repair_needed','refund_pending','disputed'
    );
create index if not exists marketplace_payments_buyer_idx
  on marketplace_payments(buyer_user_id);
create index if not exists marketplace_payments_status_idx
  on marketplace_payments(status);
create index if not exists marketplace_payments_purchase_idx
  on marketplace_payments(purchase_id);
create index if not exists marketplace_payments_listing_idx
  on marketplace_payments(resale_listing_id);
create trigger marketplace_payments_touch
  before update on marketplace_payments
  for each row execute function touch_updated_at();

-- ===== marketplace_transfers ===============================================
-- One row per connected-account transfer created against a successful
-- marketplace payment. Resale payments can have two rows (resale seller
-- + organizer royalty); primary payments have one (organizer).
create table if not exists marketplace_transfers (
  id uuid primary key default gen_random_uuid(),
  marketplace_payment_id uuid not null
    references marketplace_payments(id) on delete cascade,
  recipient_user_id uuid not null references profiles(id),
  recipient_role marketplace_transfer_recipient_role not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency currency not null,
  stripe_connected_account_id text not null,
  stripe_transfer_id text unique,
  stripe_transfer_reversal_id text,
  status marketplace_transfer_status not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketplace_transfers_currency_eur_only
    check (currency = 'EUR'),
  unique (marketplace_payment_id, recipient_role)
);
create index if not exists marketplace_transfers_payment_idx
  on marketplace_transfers(marketplace_payment_id);
create index if not exists marketplace_transfers_recipient_idx
  on marketplace_transfers(recipient_user_id);
create trigger marketplace_transfers_touch
  before update on marketplace_transfers
  for each row execute function touch_updated_at();

-- ===== RLS lockdown =========================================================
-- All three tables are service-role only. There is no anon/auth client
-- read path: server components and API routes use the service client
-- and project only the fields the caller needs.
alter table stripe_seller_accounts enable row level security;
alter table marketplace_payments  enable row level security;
alter table marketplace_transfers enable row level security;

revoke all on stripe_seller_accounts from anon, authenticated;
revoke all on marketplace_payments  from anon, authenticated;
revoke all on marketplace_transfers from anon, authenticated;
