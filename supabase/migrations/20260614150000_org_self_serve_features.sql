-- P1.5 / P1.7 / P1.8 — organization self-serve feature columns, staged together
-- so the generated types regenerate once. Implementation (lib + UI) is built
-- on top of these columns.

-- P1.5 Storefront themes: a curated preset key lives in this jsonb ({ preset }).
-- Null = the default "ink" theme. RLS on organizations (org-admin all) already
-- governs writes.
alter table organizations add column if not exists theme jsonb;

-- P1.7 Per-country resale price caps: the org's default max markup (bps) over a
-- ticket's original online total, plus a country override table. cap_bps = 0
-- means face-value-only (the current behavior); 1000 = +10% allowed.
alter table organizations
  add column if not exists resale_cap_bps integer not null default 0,
  add column if not exists country_code text;

create table if not exists resale_price_caps (
  country_code text primary key,
  cap_bps integer not null check (cap_bps >= 0),
  label text,
  updated_at timestamptz not null default now()
);

-- Seed the jurisdictions the research flagged (face-only unless noted).
insert into resale_price_caps (country_code, cap_bps, label) values
  ('FR', 1000, 'France — face +10% cap'),
  ('BE', 0, 'Belgium — face value'),
  ('ES', 0, 'Spain — face value'),
  ('GB', 0, 'United Kingdom — face value (Bill pending)'),
  ('IE', 0, 'Ireland — face value')
on conflict (country_code) do nothing;

alter table resale_price_caps enable row level security;
-- Reference policy data: readable by anyone (informs storefront copy), writable
-- only by the service role (no policy for insert/update/delete).
drop policy if exists "resale_price_caps_public_select" on resale_price_caps;
create policy "resale_price_caps_public_select" on resale_price_caps
  for select using (true);

-- P1.8 Custom domains: an org maps one apex/subdomain to its storefront. The
-- token proves DNS control; verified_at gates host-based routing.
alter table organizations
  add column if not exists custom_domain text,
  add column if not exists custom_domain_verified_at timestamptz,
  add column if not exists custom_domain_verification_token text;

create unique index if not exists organizations_custom_domain_key
  on organizations (lower(custom_domain))
  where custom_domain is not null;
