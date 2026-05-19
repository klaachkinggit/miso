-- Stores admin-controlled public landing page artwork.
-- One row keeps the homepage media independent from any individual event.

create table if not exists site_settings (
  id text primary key default 'default',
  landing_hero_bg_url text,
  landing_audience_url text,
  landing_dashboard_url text,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = 'default')
);

alter table site_settings enable row level security;

drop policy if exists "site_settings_public_select" on site_settings;
create policy "site_settings_public_select" on site_settings
  for select using (true);

drop policy if exists "site_settings_admin_all" on site_settings;
create policy "site_settings_admin_all" on site_settings
  for all using (public.has_role(array['admin', 'organizer']::user_role[]))
  with check (public.has_role(array['admin', 'organizer']::user_role[]));

insert into site_settings (id)
values ('default')
on conflict (id) do nothing;

create trigger site_settings_touch_updated_at
before update on site_settings
for each row execute function touch_updated_at();
