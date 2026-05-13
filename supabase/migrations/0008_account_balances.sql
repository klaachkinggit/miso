-- Migration 0008 — Account Balance ledger.
--
-- Intra-app transactions settle through Account Balance, not through the mock
-- payment provider. Charge/cashout remain future external funding rails.

create type balance_movement_type as enum (
  'seed_credit',
  'admin_topup_credit',
  'purchase_debit',
  'resale_buyer_debit',
  'resale_seller_credit',
  'refund_credit',
  'compensation_credit'
);

-- ===== account_balances =====================================================
create table account_balances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  currency currency not null,
  available_amount numeric(12,2) not null default 0 check (available_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, currency)
);
create index account_balances_profile_idx on account_balances(profile_id);
create trigger account_balances_touch before update on account_balances
  for each row execute function touch_updated_at();

-- ===== balance_ledger_entries ==============================================
create table balance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_balance_id uuid not null references account_balances(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  movement_type balance_movement_type not null,
  amount numeric(12,2) not null check (amount > 0),
  currency currency not null,
  reference_type text not null,
  reference_id text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, currency, movement_type, reference_type, reference_id)
);
create index balance_ledger_profile_idx on balance_ledger_entries(profile_id, created_at desc);
create index balance_ledger_balance_idx on balance_ledger_entries(account_balance_id, created_at desc);

-- ===== helpers ==============================================================
create or replace function assert_balance_holder(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  holder_role user_role;
begin
  select role into holder_role from profiles where id = p_profile_id;
  if holder_role is null then
    raise exception 'Balance holder not found' using errcode = 'P0002';
  end if;
  if holder_role = 'controller' then
    raise exception 'Controllers cannot hold Account Balance' using errcode = 'P0001';
  end if;
end $$;

create or replace function account_balance_credit(
  p_profile_id uuid,
  p_currency currency,
  p_movement_type balance_movement_type,
  p_amount numeric,
  p_reference_type text,
  p_reference_id text
) returns balance_ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_entry balance_ledger_entries;
  balance_row account_balances;
  inserted_entry balance_ledger_entries;
  normalized_amount numeric(12,2);
begin
  if p_movement_type not in ('seed_credit', 'admin_topup_credit', 'resale_seller_credit', 'refund_credit', 'compensation_credit') then
    raise exception 'Movement type % is not a credit', p_movement_type using errcode = 'P0001';
  end if;

  normalized_amount := round(p_amount, 2);
  if normalized_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;

  perform assert_balance_holder(p_profile_id);

  select * into existing_entry
  from balance_ledger_entries
  where profile_id = p_profile_id
    and currency = p_currency
    and movement_type = p_movement_type
    and reference_type = p_reference_type
    and reference_id = p_reference_id;
  if found then
    return existing_entry;
  end if;

  insert into account_balances (profile_id, currency, available_amount)
  values (p_profile_id, p_currency, 0)
  on conflict (profile_id, currency) do nothing;

  select * into balance_row
  from account_balances
  where profile_id = p_profile_id and currency = p_currency
  for update;

  update account_balances
  set available_amount = available_amount + normalized_amount
  where id = balance_row.id
  returning * into balance_row;

  insert into balance_ledger_entries (
    account_balance_id,
    profile_id,
    movement_type,
    amount,
    currency,
    reference_type,
    reference_id
  ) values (
    balance_row.id,
    p_profile_id,
    p_movement_type,
    normalized_amount,
    p_currency,
    p_reference_type,
    p_reference_id
  )
  returning * into inserted_entry;

  return inserted_entry;
exception
  when unique_violation then
    select * into existing_entry
    from balance_ledger_entries
    where profile_id = p_profile_id
      and currency = p_currency
      and movement_type = p_movement_type
      and reference_type = p_reference_type
      and reference_id = p_reference_id;
    if found then
      return existing_entry;
    end if;
    raise;
end $$;

create or replace function account_balance_debit(
  p_profile_id uuid,
  p_currency currency,
  p_movement_type balance_movement_type,
  p_amount numeric,
  p_reference_type text,
  p_reference_id text
) returns balance_ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_entry balance_ledger_entries;
  balance_row account_balances;
  inserted_entry balance_ledger_entries;
  normalized_amount numeric(12,2);
begin
  if p_movement_type not in ('purchase_debit', 'resale_buyer_debit') then
    raise exception 'Movement type % is not a debit', p_movement_type using errcode = 'P0001';
  end if;

  normalized_amount := round(p_amount, 2);
  if normalized_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;

  perform assert_balance_holder(p_profile_id);

  select * into existing_entry
  from balance_ledger_entries
  where profile_id = p_profile_id
    and currency = p_currency
    and movement_type = p_movement_type
    and reference_type = p_reference_type
    and reference_id = p_reference_id;
  if found then
    return existing_entry;
  end if;

  insert into account_balances (profile_id, currency, available_amount)
  values (p_profile_id, p_currency, 0)
  on conflict (profile_id, currency) do nothing;

  select * into balance_row
  from account_balances
  where profile_id = p_profile_id and currency = p_currency
  for update;

  if balance_row.available_amount < normalized_amount then
    raise exception 'Insufficient Account Balance' using errcode = 'P0001';
  end if;

  update account_balances
  set available_amount = available_amount - normalized_amount
  where id = balance_row.id
  returning * into balance_row;

  insert into balance_ledger_entries (
    account_balance_id,
    profile_id,
    movement_type,
    amount,
    currency,
    reference_type,
    reference_id
  ) values (
    balance_row.id,
    p_profile_id,
    p_movement_type,
    normalized_amount,
    p_currency,
    p_reference_type,
    p_reference_id
  )
  returning * into inserted_entry;

  return inserted_entry;
exception
  when unique_violation then
    select * into existing_entry
    from balance_ledger_entries
    where profile_id = p_profile_id
      and currency = p_currency
      and movement_type = p_movement_type
      and reference_type = p_reference_type
      and reference_id = p_reference_id;
    if found then
      return existing_entry;
    end if;
    raise;
end $$;

-- ===== RLS =================================================================
alter table account_balances enable row level security;
alter table balance_ledger_entries enable row level security;

create policy "balances_self_select" on account_balances
  for select using (profile_id = auth.uid());

create policy "balances_admin_all" on account_balances
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "balance_ledger_self_select" on balance_ledger_entries
  for select using (profile_id = auth.uid());

create policy "balance_ledger_admin_all" on balance_ledger_entries
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
