-- P1.1 Waitlist for sold-out events.
--
-- A buyer joins an event's waitlist when it is sold out. When availability
-- returns (ticket released/refunded, or a resale listing appears) the queue
-- head is emailed with a 24h claim note.

create table if not exists event_waitlists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  claim_expires_at timestamptz,
  unique (event_id, user_id)
);

create index if not exists event_waitlists_event_created_idx
  on event_waitlists(event_id, created_at);

alter table event_waitlists enable row level security;

drop policy if exists "event_waitlists_self_select" on event_waitlists;
create policy "event_waitlists_self_select" on event_waitlists
  for select using (user_id = (select auth.uid()));

drop policy if exists "event_waitlists_self_insert" on event_waitlists;
create policy "event_waitlists_self_insert" on event_waitlists
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "event_waitlists_self_delete" on event_waitlists;
create policy "event_waitlists_self_delete" on event_waitlists
  for delete using (user_id = (select auth.uid()));

drop policy if exists "event_waitlists_organization_admin_select" on event_waitlists;
create policy "event_waitlists_organization_admin_select" on event_waitlists
  for select using (
    exists (
      select 1
        from events e
       where e.id = event_waitlists.event_id
         and public.is_organization_admin(e.organization_id)
    )
  );
