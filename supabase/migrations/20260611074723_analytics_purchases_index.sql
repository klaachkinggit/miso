-- Index to support the Organization Analytics dashboard loader
-- (`loadOrganizationAnalytics`). The dashboard's revenue + time-series
-- queries scan purchases by event id over a date window; this composite
-- index lets Postgres serve those scans without filtering all purchases
-- per organization.

create index if not exists purchases_event_id_created_at_idx
  on purchases (event_id, created_at desc);
