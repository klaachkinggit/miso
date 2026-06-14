-- P1.3 Promo codes + scheduled releases (sale windows).
--
-- A promo code is an org-scoped discount applied at primary checkout. It is
-- validated server-side only (service-role at checkout) — never trusted from
-- the client. The organizer absorbs the discount: the discounted gross flows
-- through computePrimaryBreakdown so the buyer charge, marketplace fee, and
-- primary-seller transfer all recompute consistently.
--
-- A sale window (ticket_categories.sale_starts_at / sale_ends_at) gates when a
-- category can be reserved/checked out. Null bounds mean always-open. An
-- "early-bird" tier is simply a category whose window is currently open.

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  discount_kind text not null check (discount_kind in ('percent', 'fixed')),
  percent_off int check (percent_off between 1 and 100),
  amount_off_cents int check (amount_off_cents > 0),
  max_uses int,
  used_count int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Exactly one discount value is set, and it matches the kind.
  constraint promo_codes_discount_shape check (
    (discount_kind = 'percent' and percent_off is not null and amount_off_cents is null)
    or (discount_kind = 'fixed' and amount_off_cents is not null and percent_off is null)
  )
);

create unique index if not exists promo_codes_org_code_idx
  on promo_codes (organization_id, lower(code));

create index if not exists promo_codes_organization_idx
  on promo_codes (organization_id);

alter table marketplace_payments
  add column if not exists promo_code_id uuid references promo_codes(id),
  add column if not exists discount_cents int not null default 0;

alter table ticket_categories
  add column if not exists sale_starts_at timestamptz,
  add column if not exists sale_ends_at timestamptz;

alter table promo_codes enable row level security;

-- Org admins manage their own codes. No anon/authenticated SELECT: validation
-- runs server-side via the service-role client at checkout, so buyers must
-- never be able to enumerate codes or read discount amounts.
drop policy if exists "promo_codes_organization_admin_all" on promo_codes;
create policy "promo_codes_organization_admin_all" on promo_codes
  for all
  using (public.is_organization_admin(promo_codes.organization_id))
  with check (public.is_organization_admin(promo_codes.organization_id));

-- Atomic conditional increment. The WHERE guard makes the last-use claim
-- race-safe: two concurrent checkouts cannot both consume the final use.
-- Returns the row only when a use was actually consumed; returns nothing when
-- the code is already exhausted. SECURITY DEFINER, locked to service_role
-- (checkout runs under the service-role client). PostgREST cannot express a
-- column-vs-column guard on UPDATE, so this lives in an RPC.
create or replace function public.increment_promo_use(promo_id uuid)
returns setof promo_codes
language sql
security definer
set search_path = public
as $$
  update promo_codes
     set used_count = used_count + 1
   where id = promo_id
     and (max_uses is null or used_count < max_uses)
  returning *;
$$;

revoke execute on function public.increment_promo_use(uuid) from public, anon, authenticated;
grant execute on function public.increment_promo_use(uuid) to service_role;
