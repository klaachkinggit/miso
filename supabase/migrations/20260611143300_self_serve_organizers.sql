-- Self-serve organizer onboarding.
--
-- Organizers now self-declare into a Sandbox profile, complete legal
-- + Stripe Connect compliance, then become Live without platform-admin
-- role promotion. The user role stays coarse (`organizer`); compliance
-- state lives in organizer_profiles.

create table if not exists organizer_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'sandbox'
    check (status in ('sandbox', 'live')),

  event_typology text not null
    check (event_typology in (
      'clubbing',
      'open_air_warehouse',
      'concerts',
      'festivals',
      'autre'
    )),
  volume_estimation text not null
    check (volume_estimation in (
      'un_seul',
      'jusqua_10',
      'de_11_a_25',
      'plus_de_25'
    )),
  ticketing_footprint text not null
    check (ticketing_footprint in (
      'gratuit',
      'moins_de_15',
      'quinze_ou_plus'
    )),

  siret text,
  no_siret boolean not null default false,
  legal_verified_at timestamptz,
  stripe_verified_at timestamptz,
  activated_at timestamptz,

  page_name text,
  page_slug text unique,
  page_description text,
  widget_accent_color text not null default '#B89B5E',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organizer_profiles_legal_identity
    check (
      (siret is null and no_siret = false)
      or (siret is not null and no_siret = false)
      or (siret is null and no_siret = true)
    ),
  constraint organizer_profiles_siret_format
    check (
      siret is null
      or siret ~ '^[A-Z0-9][A-Z0-9 -]{4,34}[A-Z0-9]$'
    ),
  constraint organizer_profiles_widget_color_format
    check (widget_accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

drop trigger if exists organizer_profiles_touch on organizer_profiles;
create trigger organizer_profiles_touch
  before update on organizer_profiles
  for each row execute function touch_updated_at();

create index if not exists organizer_profiles_status_idx
  on organizer_profiles(status);

alter table organizer_profiles enable row level security;

create policy "organizer_profiles_self_select" on organizer_profiles
  for select using (user_id = auth.uid());

create policy "organizer_profiles_admin_select" on organizer_profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

revoke insert, update, delete on organizer_profiles from anon, authenticated;

-- Recompute organizer Sandbox/Live status from legal identity +
-- mirrored Stripe Connect readiness. Operator-set seller risk states
-- (`owes_recovery`, `blocked`) are respected through seller_risk_status.
create or replace function refresh_organizer_live_status(p_user_id uuid)
returns organizer_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row organizer_profiles;
  seller_row stripe_seller_accounts;
  legal_ready boolean;
  stripe_ready boolean;
begin
  select * into profile_row
  from organizer_profiles
  where user_id = p_user_id
  for update;

  if not found then
    return null;
  end if;

  select * into seller_row
  from stripe_seller_accounts
  where user_id = p_user_id;

  legal_ready := profile_row.no_siret or profile_row.siret is not null;
  stripe_ready :=
    coalesce(seller_row.charges_enabled, false)
    and coalesce(seller_row.payouts_enabled, false)
    and coalesce(seller_row.details_submitted, false)
    and coalesce(seller_row.seller_risk_status = 'clear'::seller_risk_status, false);

  update organizer_profiles
  set
    status = case when legal_ready and stripe_ready then 'live' else 'sandbox' end,
    legal_verified_at = case
      when legal_ready then coalesce(legal_verified_at, now())
      else null
    end,
    stripe_verified_at = case
      when stripe_ready then coalesce(stripe_verified_at, now())
      else null
    end,
    activated_at = case
      when legal_ready and stripe_ready then coalesce(activated_at, now())
      else activated_at
    end
  where user_id = p_user_id
  returning * into profile_row;

  return profile_row;
end $$;

revoke execute on function refresh_organizer_live_status(uuid)
  from public, anon, authenticated;
grant execute on function refresh_organizer_live_status(uuid)
  to service_role;

create or replace function refresh_organizer_live_status_after_seller_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform refresh_organizer_live_status(new.user_id);
  return new;
end $$;

drop trigger if exists stripe_seller_accounts_refresh_organizer
  on stripe_seller_accounts;
create trigger stripe_seller_accounts_refresh_organizer
  after insert or update of charges_enabled, payouts_enabled, details_submitted, seller_risk_status
  on stripe_seller_accounts
  for each row execute function refresh_organizer_live_status_after_seller_update();
