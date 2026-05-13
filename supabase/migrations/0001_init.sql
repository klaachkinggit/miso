-- Miso — initial schema
-- All ticketing entities. Auth users live in auth.users (Supabase Auth).

create extension if not exists "pgcrypto";

-- ===== Enums ================================================================
create type user_role        as enum ('user', 'controller', 'admin');
create type wallet_type      as enum ('custodial', 'external');
create type event_status     as enum ('draft', 'published', 'canceled', 'completed');
create type currency         as enum ('MAD');
create type ticket_status    as enum ('available', 'reserved', 'sold', 'listed', 'used', 'refunded', 'canceled');
create type purchase_status  as enum ('pending', 'paid', 'failed', 'refunded');
create type listing_status   as enum ('active', 'sold', 'canceled', 'expired');
create type redemption_result as enum (
  'valid', 'already_used', 'refunded', 'canceled',
  'wrong_event', 'expired', 'owner_mismatch', 'invalid_signature'
);

-- ===== profiles (mirror of auth.users) =====================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role user_role not null default 'user',
  pro_crypto_mode boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== wallets ==============================================================
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  wallet_address text not null unique,
  -- MVP-ONLY: AES-256-GCM ciphertext of the Ed25519 secret key (base58 plaintext).
  -- NEVER expose this column to clients. RLS denies SELECT. Service role only.
  encrypted_secret_key text,
  wallet_type wallet_type not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);
create index wallets_user_idx on wallets(user_id);

-- ===== events ===============================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamptz not null,
  venue_name text not null,
  city text not null,
  capacity int not null check (capacity > 0),
  image_url text,
  description text,
  conditions text,
  sales_enabled boolean not null default false,
  resale_enabled boolean not null default false,
  public_sales_counter_enabled boolean not null default false,
  status event_status not null default 'draft',
  solana_collection_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_status_idx on events(status);
create index events_date_idx on events(date);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger events_touch before update on events
  for each row execute function touch_updated_at();

-- ===== ticket_categories ====================================================
create table ticket_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency currency not null,
  supply int not null check (supply > 0),
  sold_count int not null default 0,
  max_resale_price numeric(12,2),
  resale_enabled boolean not null default true,
  benefits text,
  created_at timestamptz not null default now()
);
create index categories_event_idx on ticket_categories(event_id);

-- ===== tickets ==============================================================
create table tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid not null references ticket_categories(id),
  serial_number int not null,
  owner_user_id uuid references profiles(id),
  owner_wallet_address text,
  nft_asset_address text,
  metadata_uri text,
  image_url text,
  status ticket_status not null default 'available',
  reserved_until timestamptz,
  original_purchase_id uuid,
  current_listing_id uuid,
  minted_at timestamptz,
  used_at timestamptz,
  refunded_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, serial_number)
);
create index tickets_event_idx on tickets(event_id);
create index tickets_owner_idx on tickets(owner_user_id);
create index tickets_status_idx on tickets(status);
create trigger tickets_touch before update on tickets
  for each row execute function touch_updated_at();

-- ===== purchases ============================================================
create table purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references profiles(id),
  event_id uuid not null references events(id),
  ticket_id uuid not null references tickets(id),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount numeric(12,2) not null,
  currency currency not null,
  status purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index purchases_buyer_idx on purchases(buyer_user_id);
create index purchases_status_idx on purchases(status);

-- ===== resale_listings ======================================================
create table resale_listings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  seller_user_id uuid not null references profiles(id),
  buyer_user_id uuid references profiles(id),
  price numeric(12,2) not null check (price >= 0),
  currency currency not null,
  status listing_status not null default 'active',
  stripe_checkout_session_id text unique,
  created_at timestamptz not null default now(),
  sold_at timestamptz
);
create index listings_status_idx on resale_listings(status);
create index listings_ticket_idx on resale_listings(ticket_id);

alter table tickets
  add constraint tickets_current_listing_fk
  foreign key (current_listing_id) references resale_listings(id) on delete set null;

-- ===== verification_challenges ==============================================
create table verification_challenges (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  event_id uuid not null references events(id),
  wallet_address text not null,
  nonce text not null,
  verification_code text not null unique,
  signature text,
  expires_at timestamptz not null,
  used_at timestamptz,
  controller_user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index challenges_code_active_idx
  on verification_challenges(verification_code) where used_at is null;

-- ===== ticket_redemptions ===================================================
create table ticket_redemptions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  event_id uuid not null references events(id),
  controller_user_id uuid not null references profiles(id),
  wallet_address text not null,
  signature text,
  redeemed_at timestamptz not null default now(),
  gate_name text,
  result redemption_result not null
);
create unique index unique_valid_redemption
  on ticket_redemptions(ticket_id) where result = 'valid';

-- ===== event_controllers ====================================================
create table event_controllers (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ===== audit_logs ===========================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata_json jsonb,
  created_at timestamptz not null default now()
);
create index audit_action_idx on audit_logs(action);
create index audit_entity_idx on audit_logs(entity_type, entity_id);

-- ===== Storage buckets ======================================================
insert into storage.buckets (id, name, public)
  values ('event-images', 'event-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('nft-metadata', 'nft-metadata', true)
  on conflict (id) do nothing;
