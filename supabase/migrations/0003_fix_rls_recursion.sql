-- Fix recursive admin checks in RLS policies.
-- Policies on profiles cannot safely query profiles directly; use
-- security-definer helpers so the role lookup bypasses RLS.

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.has_role(roles user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any(roles), false)
$$;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_role(user_role[]) to anon, authenticated;

drop policy if exists "profiles_admin_select" on profiles;
create policy "profiles_admin_select" on profiles
  for select using (public.is_admin());

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());

drop policy if exists "events_admin_all" on events;
create policy "events_admin_all" on events
  for all using (public.is_admin());

drop policy if exists "events_controller_select" on events;
create policy "events_controller_select" on events
  for select using (
    public.has_role(array['controller', 'admin']::user_role[])
    and exists (
      select 1 from event_controllers ec
      where ec.event_id = events.id and ec.user_id = auth.uid()
    )
  );

drop policy if exists "categories_admin_all" on ticket_categories;
create policy "categories_admin_all" on ticket_categories
  for all using (public.is_admin());

drop policy if exists "tickets_admin_all" on tickets;
create policy "tickets_admin_all" on tickets
  for all using (public.is_admin());

drop policy if exists "purchases_admin_all" on purchases;
create policy "purchases_admin_all" on purchases
  for all using (public.is_admin());

drop policy if exists "listings_admin_all" on resale_listings;
create policy "listings_admin_all" on resale_listings
  for all using (public.is_admin());

drop policy if exists "redemptions_admin_all" on ticket_redemptions;
create policy "redemptions_admin_all" on ticket_redemptions
  for all using (public.is_admin());

drop policy if exists "event_controllers_admin_all" on event_controllers;
create policy "event_controllers_admin_all" on event_controllers
  for all using (public.is_admin());

drop policy if exists "audit_admin_all" on audit_logs;
create policy "audit_admin_all" on audit_logs
  for all using (public.is_admin());

drop policy if exists "event_images_admin_write" on storage.objects;
create policy "event_images_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and public.is_admin()
  );
