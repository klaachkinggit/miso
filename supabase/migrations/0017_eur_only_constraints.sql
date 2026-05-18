-- Migration 0017 — Switch product currency to EUR end-to-end.
--
-- Drops the MAD-only constraints, rewrites all money-bearing rows to EUR,
-- then re-adds the constraints as EUR-only.

alter table ticket_categories drop constraint if exists ticket_categories_currency_mad;
alter table purchases drop constraint if exists purchases_currency_mad;
alter table resale_listings drop constraint if exists resale_listings_currency_mad;
alter table account_balances drop constraint if exists account_balances_currency_mad;
alter table balance_ledger_entries drop constraint if exists balance_ledger_entries_currency_mad;

update ticket_categories set currency = 'EUR' where currency <> 'EUR';
update purchases set currency = 'EUR' where currency <> 'EUR';
update resale_listings set currency = 'EUR' where currency <> 'EUR';

create temp table eur_balance_merge on commit drop as
  select profile_id, sum(available_amount) as available_amount
  from account_balances
  where currency <> 'EUR'
  group by profile_id;

insert into account_balances (profile_id, currency, available_amount)
select profile_id, 'EUR', 0
from eur_balance_merge
on conflict (profile_id, currency) do nothing;

update account_balances ab
set available_amount = ab.available_amount + merge.available_amount
from eur_balance_merge merge
where ab.profile_id = merge.profile_id and ab.currency = 'EUR';

update balance_ledger_entries entry
set account_balance_id = eur_balance.id,
    currency = 'EUR'
from account_balances eur_balance
where entry.profile_id = eur_balance.profile_id
  and eur_balance.currency = 'EUR'
  and entry.currency <> 'EUR';

delete from account_balances where currency <> 'EUR';

alter table ticket_categories
  add constraint ticket_categories_currency_eur check (currency = 'EUR');

alter table purchases
  add constraint purchases_currency_eur check (currency = 'EUR');

alter table resale_listings
  add constraint resale_listings_currency_eur check (currency = 'EUR');

alter table account_balances
  add constraint account_balances_currency_eur check (currency = 'EUR');

alter table balance_ledger_entries
  add constraint balance_ledger_entries_currency_eur check (currency = 'EUR');
