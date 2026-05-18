alter table events
  add column if not exists organizer_user_id uuid references profiles(id);

create index if not exists events_organizer_user_idx on events(organizer_user_id);

drop policy if exists "events_controller_select" on events;
create policy "events_controller_select" on events
  for select using (
    public.has_role(array['controller', 'admin', 'organizer']::user_role[])
    and exists (
      select 1 from event_controllers ec
      where ec.event_id = events.id and ec.user_id = auth.uid()
    )
  );

drop policy if exists "events_organizer_all" on events;
create policy "events_organizer_all" on events
  for all
  using (
    public.has_role(array['organizer']::user_role[])
    and organizer_user_id = auth.uid()
  )
  with check (
    public.has_role(array['organizer']::user_role[])
    and organizer_user_id = auth.uid()
  );

drop policy if exists "categories_organizer_all" on ticket_categories;
create policy "categories_organizer_all" on ticket_categories
  for all
  using (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = ticket_categories.event_id
        and e.organizer_user_id = auth.uid()
    )
  )
  with check (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = ticket_categories.event_id
        and e.organizer_user_id = auth.uid()
    )
  );

drop policy if exists "tickets_organizer_all" on tickets;
create policy "tickets_organizer_all" on tickets
  for all
  using (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = tickets.event_id
        and e.organizer_user_id = auth.uid()
    )
  )
  with check (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = tickets.event_id
        and e.organizer_user_id = auth.uid()
    )
  );

drop policy if exists "purchases_organizer_select" on purchases;
create policy "purchases_organizer_select" on purchases
  for select using (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = purchases.event_id
        and e.organizer_user_id = auth.uid()
    )
  );

drop policy if exists "redemptions_organizer_select" on ticket_redemptions;
create policy "redemptions_organizer_select" on ticket_redemptions
  for select using (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = ticket_redemptions.event_id
        and e.organizer_user_id = auth.uid()
    )
  );

drop policy if exists "event_controllers_organizer_all" on event_controllers;
create policy "event_controllers_organizer_all" on event_controllers
  for all
  using (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = event_controllers.event_id
        and e.organizer_user_id = auth.uid()
    )
  )
  with check (
    public.has_role(array['organizer']::user_role[])
    and exists (
      select 1 from events e
      where e.id = event_controllers.event_id
        and e.organizer_user_id = auth.uid()
    )
  );

drop policy if exists "event_images_admin_write" on storage.objects;
create policy "event_images_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and public.has_role(array['admin', 'organizer']::user_role[])
  );
