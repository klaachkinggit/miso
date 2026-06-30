-- P1.2 Organization followers + announcements.
--
-- A buyer follows an Organization to receive its announcements. Followers are
-- created explicitly (Follow button) or implicitly on a paid purchase
-- (auto-follow). Each row carries an unguessable unsubscribe_token so a
-- recipient can opt out via a capability link without authenticating.

create table if not exists organization_followers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid(),
  unique (organization_id, user_id)
);

create index if not exists organization_followers_organization_idx
  on organization_followers(organization_id);

create unique index if not exists organization_followers_unsubscribe_token_idx
  on organization_followers(unsubscribe_token);

alter table organization_followers enable row level security;

drop policy if exists "organization_followers_self_select" on organization_followers;
create policy "organization_followers_self_select" on organization_followers
  for select using (user_id = (select auth.uid()));

drop policy if exists "organization_followers_self_insert" on organization_followers;
create policy "organization_followers_self_insert" on organization_followers
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "organization_followers_self_delete" on organization_followers;
create policy "organization_followers_self_delete" on organization_followers
  for delete using (user_id = (select auth.uid()));

drop policy if exists "organization_followers_organization_admin_select" on organization_followers;
create policy "organization_followers_organization_admin_select" on organization_followers
  for select using (public.is_organization_admin(organization_followers.organization_id));
