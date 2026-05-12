-- Row-Level Security policies.
-- Sensitive mutations all go through server actions w/ service_role, but RLS
-- is enforced as defense-in-depth.

-- ===== profiles =============================================================
alter table profiles enable row level security;

create policy "profiles_self_select" on profiles
  for select using (id = auth.uid());

create policy "profiles_admin_select" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles_self_update" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
  -- prevent privilege escalation: role can't be changed via client

-- ===== wallets ==============================================================
alter table wallets enable row level security;

-- Owner reads own wallet but NOT encrypted_secret_key (column-level revoke below)
create policy "wallets_self_select" on wallets
  for select using (user_id = auth.uid());

revoke select (encrypted_secret_key) on wallets from anon, authenticated;

-- ===== events ===============================================================
alter table events enable row level security;

create policy "events_public_select" on events
  for select using (status = 'published');

create policy "events_admin_all" on events
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "events_controller_select" on events
  for select using (
    exists (select 1 from event_controllers ec
            join profiles p on p.id = auth.uid()
            where ec.event_id = events.id and ec.user_id = auth.uid()
            and p.role in ('controller', 'admin'))
  );

-- ===== ticket_categories ====================================================
alter table ticket_categories enable row level security;

create policy "categories_public_select" on ticket_categories
  for select using (
    exists (select 1 from events e where e.id = ticket_categories.event_id and e.status = 'published')
  );

create policy "categories_admin_all" on ticket_categories
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ===== tickets ==============================================================
alter table tickets enable row level security;

create policy "tickets_owner_select" on tickets
  for select using (owner_user_id = auth.uid());

create policy "tickets_admin_all" on tickets
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "tickets_listed_public_select" on tickets
  for select using (status = 'listed');

-- ===== purchases ============================================================
alter table purchases enable row level security;

create policy "purchases_buyer_select" on purchases
  for select using (buyer_user_id = auth.uid());

create policy "purchases_admin_all" on purchases
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ===== resale_listings ======================================================
alter table resale_listings enable row level security;

create policy "listings_public_active" on resale_listings
  for select using (status = 'active');

create policy "listings_seller_select" on resale_listings
  for select using (seller_user_id = auth.uid());

create policy "listings_admin_all" on resale_listings
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ===== verification_challenges (server-only) ================================
alter table verification_challenges enable row level security;
-- no policies → only service_role can read/write

-- ===== ticket_redemptions ===================================================
alter table ticket_redemptions enable row level security;

create policy "redemptions_admin_all" on ticket_redemptions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "redemptions_controller_select" on ticket_redemptions
  for select using (
    exists (
      select 1 from event_controllers ec
      where ec.event_id = ticket_redemptions.event_id and ec.user_id = auth.uid()
    )
  );

-- ===== event_controllers ====================================================
alter table event_controllers enable row level security;

create policy "event_controllers_self_select" on event_controllers
  for select using (user_id = auth.uid());

create policy "event_controllers_admin_all" on event_controllers
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ===== audit_logs ===========================================================
alter table audit_logs enable row level security;

create policy "audit_admin_all" on audit_logs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ===== Storage policies =====================================================
create policy "event_images_public_read"
  on storage.objects for select
  using (bucket_id = 'event-images');

create policy "event_images_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "nft_metadata_public_read"
  on storage.objects for select
  using (bucket_id = 'nft-metadata');
-- Writes to nft-metadata only via service_role (no policy).
