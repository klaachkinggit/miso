-- Keep event-related RLS checks from recursively evaluating policies.
-- The helper functions are security-definer so their internal lookups bypass
-- RLS and can safely be used inside policies on events and related tables.

create or replace function public.is_event_published(check_event_id uuid)
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
         and e.status = 'published'
    ),
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
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1
        from public.events e
       where e.id = check_event_id
         and e.organizer_user_id = auth.uid()
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
    public.has_role(array['controller', 'admin', 'organizer']::user_role[])
    and exists (
      select 1
        from public.event_controllers ec
       where ec.event_id = check_event_id
         and ec.user_id = auth.uid()
    ),
    false
  )
$$;

grant execute on function public.is_event_published(uuid) to anon, authenticated;
grant execute on function public.organizes_event(uuid) to anon, authenticated;
grant execute on function public.controls_event(uuid) to anon, authenticated;

drop policy if exists "events_controller_select" on events;
create policy "events_controller_select" on events
  for select using (public.controls_event(events.id));

drop policy if exists "categories_public_select" on ticket_categories;
create policy "categories_public_select" on ticket_categories
  for select using (public.is_event_published(ticket_categories.event_id));

drop policy if exists "categories_organizer_all" on ticket_categories;
create policy "categories_organizer_all" on ticket_categories
  for all
  using (public.organizes_event(ticket_categories.event_id))
  with check (public.organizes_event(ticket_categories.event_id));

drop policy if exists "tickets_organizer_all" on tickets;
create policy "tickets_organizer_all" on tickets
  for all
  using (public.organizes_event(tickets.event_id))
  with check (public.organizes_event(tickets.event_id));

drop policy if exists "purchases_organizer_select" on purchases;
create policy "purchases_organizer_select" on purchases
  for select using (public.organizes_event(purchases.event_id));

drop policy if exists "redemptions_organizer_select" on ticket_redemptions;
create policy "redemptions_organizer_select" on ticket_redemptions
  for select using (public.organizes_event(ticket_redemptions.event_id));

drop policy if exists "event_controllers_organizer_all" on event_controllers;
create policy "event_controllers_organizer_all" on event_controllers
  for all
  using (public.organizes_event(event_controllers.event_id))
  with check (public.organizes_event(event_controllers.event_id));
