-- P0.2 (foundation report R1): every event belongs to an organization.
--
-- The organization_foundation migration backfilled organization_id once, but
-- organizer self-serve event creation (smartboard) has since inserted events
-- with a null organization_id. Re-backfill the stragglers, then enforce the
-- invariant at the database so org-scoped billing / themes / custom domains
-- can rely on it.

-- Ensure the platform fallback org exists (idempotent with the foundation seed).
insert into organizations (name, slug)
values ('Miso', 'miso')
on conflict (slug) do nothing;

-- Backfill from the organizer's own admin membership (the org-first home org).
update events e
set organization_id = m.organization_id
from organization_memberships m
where e.organization_id is null
  and e.organizer_user_id = m.user_id
  and m.role = 'admin';

-- Final fallback: park any remaining orphans (no organizer membership) on the
-- platform 'miso' org so the NOT NULL constraint below always holds.
update events e
set organization_id = o.id
from organizations o
where e.organization_id is null
  and o.slug = 'miso';

alter table events alter column organization_id set not null;
