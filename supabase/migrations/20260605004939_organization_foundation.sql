-- Organization foundation for the platform migration.
--
-- This keeps legacy profile-based organizer ownership in place during the
-- transition, but introduces Organization as the canonical ownership boundary.

do $$ begin
  create type organization_role as enum ('admin', 'controller');
exception when duplicate_object then null; end $$;

do $$ begin
  create type organization_status as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sales_channel as enum ('mini_site', 'qr', 'marketplace', 'widget', 'ticket_office', 'invitation', 'import');
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  status organization_status not null default 'active',
  default_currency currency not null default 'EUR',
  branding jsonb not null default '{}'::jsonb,
  legal_profile jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references profiles(id) on delete set null,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  stripe_details_submitted boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  organizer_onboarding jsonb,
  resale_royalty_enabled boolean not null default false,
  resale_royalty_bps int not null default 0
    check (resale_royalty_bps >= 0 and resale_royalty_bps <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create unique index if not exists organizations_stripe_account_idx
  on organizations(stripe_account_id)
  where stripe_account_id is not null;

create index if not exists organizations_status_idx on organizations(status);

drop trigger if exists organizations_touch on organizations;
create trigger organizations_touch before update on organizations
  for each row execute function touch_updated_at();

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role organization_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx
  on organization_memberships(user_id);
create index if not exists organization_memberships_org_role_idx
  on organization_memberships(organization_id, role);

drop trigger if exists organization_memberships_touch on organization_memberships;
create trigger organization_memberships_touch before update on organization_memberships
  for each row execute function touch_updated_at();

create table if not exists organization_customers (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  source sales_channel,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_customers_user_idx
  on organization_customers(user_id);

alter table events
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists slug text,
  add column if not exists sales_channel sales_channel not null default 'mini_site';

comment on column events.organizer_user_id is
  'Legacy transition field. Use events.organization_id and organization_memberships for new organization-first code.';
comment on column profiles.role is
  'Legacy global role. Use organization_memberships.role for organization-scoped authorization in new code.';
comment on column profiles.stripe_account_id is
  'Legacy transition field. Use organizations.stripe_account_id for new Stripe Connect onboarding.';
comment on column profiles.stripe_charges_enabled is
  'Legacy transition field. Use organizations.stripe_charges_enabled for new Stripe Connect readiness.';
comment on column profiles.stripe_details_submitted is
  'Legacy transition field. Use organizations.stripe_details_submitted for new Stripe Connect readiness.';
comment on column profiles.stripe_payouts_enabled is
  'Legacy transition field. Use organizations.stripe_payouts_enabled for new Stripe Connect readiness.';
comment on column profiles.organizer_onboarding is
  'Legacy transition field. Use organizations.organizer_onboarding for new organizer setup state.';

create index if not exists events_organization_idx on events(organization_id);
create index if not exists events_organization_status_date_idx
  on events(organization_id, status, date);
create index if not exists events_sales_channel_idx on events(sales_channel);

alter table purchases
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists sales_channel sales_channel not null default 'mini_site',
  add column if not exists tracking_origin text,
  add column if not exists platform_fee_amount numeric(12,2) not null default 0
    check (platform_fee_amount >= 0),
  add column if not exists stripe_fee_amount numeric(12,2) not null default 0
    check (stripe_fee_amount >= 0),
  add column if not exists buyer_total_amount numeric(12,2)
    check (buyer_total_amount is null or buyer_total_amount >= amount);

create index if not exists purchases_organization_idx on purchases(organization_id);
create index if not exists purchases_organization_status_created_idx
  on purchases(organization_id, status, created_at);
create index if not exists purchases_sales_channel_idx on purchases(sales_channel);

alter table resale_listings
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists sales_channel sales_channel not null default 'marketplace',
  add column if not exists tracking_origin text,
  add column if not exists royalty_amount numeric(12,2) not null default 0
    check (royalty_amount >= 0);

create index if not exists listings_organization_status_idx
  on resale_listings(organization_id, status);
create index if not exists listings_sales_channel_idx on resale_listings(sales_channel);

alter table ticket_redemptions
  add column if not exists organization_id uuid references organizations(id);

create index if not exists redemptions_organization_idx
  on ticket_redemptions(organization_id, redeemed_at);

-- ===== Backfill Organizations ==============================================

insert into organizations (
  name,
  slug,
  created_by_user_id,
  stripe_account_id,
  stripe_charges_enabled,
  stripe_details_submitted,
  stripe_payouts_enabled,
  organizer_onboarding
)
select
  coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1), 'Organizer') || ' Organization',
  'org-' || substr(md5(p.id::text), 1, 12),
  p.id,
  p.stripe_account_id,
  p.stripe_charges_enabled,
  p.stripe_details_submitted,
  p.stripe_payouts_enabled,
  p.organizer_onboarding
from profiles p
where exists (
  select 1 from events e where e.organizer_user_id = p.id
)
on conflict (slug) do nothing;

insert into organizations (name, slug)
values ('Miso', 'miso')
on conflict (slug) do nothing;

update events e
set organization_id = o.id
from organizations o
where e.organization_id is null
  and e.organizer_user_id is not null
  and o.slug = 'org-' || substr(md5(e.organizer_user_id::text), 1, 12);

update events e
set organization_id = o.id
from organizations o
where e.organization_id is null
  and o.slug = 'miso';

insert into organization_memberships (organization_id, user_id, role)
select o.id, o.created_by_user_id, 'admin'::organization_role
from organizations o
where o.created_by_user_id is not null
on conflict (organization_id, user_id) do nothing;

insert into organization_memberships (organization_id, user_id, role)
select o.id, p.id, 'admin'::organization_role
from organizations o
join profiles p on p.role = 'admin'
where o.slug = 'miso'
on conflict (organization_id, user_id) do nothing;

update events
set slug =
  coalesce(
    nullif(
      trim(both '-' from lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g'))),
      ''
    ),
    'event'
  ) || '-' || substr(id::text, 1, 8)
where slug is null;

alter table events drop constraint if exists events_slug_format;
alter table events add constraint events_slug_format
  check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{0,126}[a-z0-9]$');

create unique index if not exists events_organization_slug_uniq
  on events(organization_id, slug)
  where organization_id is not null and slug is not null;

update purchases p
set organization_id = e.organization_id
from events e
where p.organization_id is null
  and p.event_id = e.id;

update resale_listings rl
set organization_id = e.organization_id
from tickets t
join events e on e.id = t.event_id
where rl.organization_id is null
  and rl.ticket_id = t.id;

update ticket_redemptions tr
set organization_id = e.organization_id
from events e
where tr.organization_id is null
  and tr.event_id = e.id;

insert into organization_customers (organization_id, user_id, source, first_seen_at, last_seen_at)
select
  p.organization_id,
  p.buyer_user_id,
  (array_agg(p.sales_channel order by p.created_at))[1],
  min(p.created_at),
  max(coalesce(p.paid_at, p.created_at))
from purchases p
group by p.organization_id, p.buyer_user_id
on conflict (organization_id, user_id) do update set
  last_seen_at = greatest(organization_customers.last_seen_at, excluded.last_seen_at),
  source = coalesce(organization_customers.source, excluded.source);

-- ===== Organization derivation triggers =====================================

create or replace function public.set_purchase_organization_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is null and new.event_id is not null then
    select e.organization_id
      into new.organization_id
      from public.events e
     where e.id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_set_organization_id on purchases;
create trigger purchases_set_organization_id
  before insert or update of event_id, organization_id on purchases
  for each row execute function public.set_purchase_organization_id();

create or replace function public.set_resale_listing_organization_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is null and new.ticket_id is not null then
    select e.organization_id
      into new.organization_id
      from public.tickets t
      join public.events e on e.id = t.event_id
     where t.id = new.ticket_id;
  end if;
  return new;
end;
$$;

drop trigger if exists resale_listings_set_organization_id on resale_listings;
create trigger resale_listings_set_organization_id
  before insert or update of ticket_id, organization_id on resale_listings
  for each row execute function public.set_resale_listing_organization_id();

create or replace function public.set_ticket_redemption_organization_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is null and new.event_id is not null then
    select e.organization_id
      into new.organization_id
      from public.events e
     where e.id = new.event_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_redemptions_set_organization_id on ticket_redemptions;
create trigger ticket_redemptions_set_organization_id
  before insert or update of event_id, organization_id on ticket_redemptions
  for each row execute function public.set_ticket_redemption_organization_id();

create or replace function public.upsert_organization_customer_from_purchase()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is not null and new.buyer_user_id is not null then
    insert into public.organization_customers (
      organization_id,
      user_id,
      source,
      first_seen_at,
      last_seen_at
    )
    values (
      new.organization_id,
      new.buyer_user_id,
      new.sales_channel,
      new.created_at,
      coalesce(new.paid_at, new.created_at)
    )
    on conflict (organization_id, user_id) do update set
      last_seen_at = greatest(
        public.organization_customers.last_seen_at,
        excluded.last_seen_at
      ),
      source = coalesce(public.organization_customers.source, excluded.source);
  end if;

  return new;
end;
$$;

drop trigger if exists purchases_upsert_organization_customer on purchases;
create trigger purchases_upsert_organization_customer
  after insert or update of organization_id, buyer_user_id, sales_channel, paid_at on purchases
  for each row execute function public.upsert_organization_customer_from_purchase();

-- ===== RLS helpers ==========================================================

create or replace function public.current_organization_role(check_organization_id uuid)
returns organization_role
language sql
stable
security definer
set search_path = public
as $$
  select om.role
    from public.organization_memberships om
   where om.organization_id = check_organization_id
     and om.user_id = (select auth.uid())
   limit 1
$$;

create or replace function public.is_organization_admin(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_organization_role(check_organization_id) = 'admin',
    false
  )
$$;

create or replace function public.is_organization_controller(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_organization_role(check_organization_id) = 'controller',
    false
  )
$$;

create or replace function public.is_organization_member(check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.current_organization_role(check_organization_id) is not null,
    false
  )
$$;

create or replace function public.organizes_event(check_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
        from public.events e
       where e.id = check_event_id
         and (
           public.is_organization_admin(e.organization_id)
           or (
             public.has_role(array['organizer']::user_role[])
             and e.organizer_user_id = (select auth.uid())
           )
         )
    ),
    false
  )
$$;

create or replace function public.controls_event(check_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
        from public.event_controllers ec
        join public.events e on e.id = ec.event_id
       where ec.event_id = check_event_id
         and ec.user_id = (select auth.uid())
         and (
           public.is_organization_admin(e.organization_id)
           or public.is_organization_controller(e.organization_id)
           or public.has_role(array['controller', 'admin', 'organizer']::user_role[])
         )
    ),
    false
  )
$$;

grant execute on function public.current_organization_role(uuid) to anon, authenticated;
grant execute on function public.is_organization_admin(uuid) to anon, authenticated;
grant execute on function public.is_organization_controller(uuid) to anon, authenticated;
grant execute on function public.is_organization_member(uuid) to anon, authenticated;
grant execute on function public.organizes_event(uuid) to anon, authenticated;
grant execute on function public.controls_event(uuid) to anon, authenticated;

-- ===== RLS policies =========================================================

alter table organizations enable row level security;
alter table organization_memberships enable row level security;
alter table organization_customers enable row level security;

drop policy if exists "organizations_public_select" on organizations;

drop policy if exists "organizations_admin_all" on organizations;
create policy "organizations_admin_all" on organizations
  for all
  using (public.is_organization_admin(organizations.id))
  with check (public.is_organization_admin(organizations.id));

drop policy if exists "organization_memberships_self_select" on organization_memberships;
create policy "organization_memberships_self_select" on organization_memberships
  for select using (user_id = (select auth.uid()));

drop policy if exists "organization_memberships_admin_all" on organization_memberships;
create policy "organization_memberships_admin_all" on organization_memberships
  for all
  using (public.is_organization_admin(organization_memberships.organization_id))
  with check (public.is_organization_admin(organization_memberships.organization_id));

drop policy if exists "organization_customers_self_select" on organization_customers;
create policy "organization_customers_self_select" on organization_customers
  for select using (user_id = (select auth.uid()));

drop policy if exists "organization_customers_admin_select" on organization_customers;
create policy "organization_customers_admin_select" on organization_customers
  for select using (public.is_organization_admin(organization_customers.organization_id));

drop policy if exists "events_organization_admin_all" on events;
create policy "events_organization_admin_all" on events
  for all
  using (public.is_organization_admin(events.organization_id))
  with check (public.is_organization_admin(events.organization_id));

drop policy if exists "purchases_organization_admin_select" on purchases;
create policy "purchases_organization_admin_select" on purchases
  for select using (public.is_organization_admin(purchases.organization_id));

drop policy if exists "listings_organization_admin_select" on resale_listings;
create policy "listings_organization_admin_select" on resale_listings
  for select using (public.is_organization_admin(resale_listings.organization_id));

drop policy if exists "redemptions_organization_admin_select" on ticket_redemptions;
create policy "redemptions_organization_admin_select" on ticket_redemptions
  for select using (public.is_organization_admin(ticket_redemptions.organization_id));
