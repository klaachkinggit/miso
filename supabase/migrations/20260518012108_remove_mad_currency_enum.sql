-- Remove the legacy MAD currency enum value now that all payment surfaces are
-- EUR-only and account balance ledger tables have been dropped.

alter table ticket_categories drop constraint if exists ticket_categories_currency_eur;
alter table purchases drop constraint if exists purchases_currency_eur;
alter table resale_listings drop constraint if exists resale_listings_currency_eur;

alter type currency rename to currency_old;
create type currency as enum ('EUR');

alter table ticket_categories
  alter column currency type currency using currency::text::currency;

alter table purchases
  alter column currency type currency using currency::text::currency;

alter table resale_listings
  alter column currency type currency using currency::text::currency;

drop type currency_old;

alter table ticket_categories
  add constraint ticket_categories_currency_eur check (currency = 'EUR');

alter table purchases
  add constraint purchases_currency_eur check (currency = 'EUR');

alter table resale_listings
  add constraint resale_listings_currency_eur check (currency = 'EUR');
