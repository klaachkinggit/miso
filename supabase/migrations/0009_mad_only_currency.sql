-- Migration 0009 — MAD-only product currency.
--
-- The app now exposes only Moroccan dirham. Existing databases may still have
-- historical enum values, but all money-bearing tables are constrained to MAD.

update ticket_categories set currency = 'MAD' where currency <> 'MAD';
update purchases set currency = 'MAD' where currency <> 'MAD';
update resale_listings set currency = 'MAD' where currency <> 'MAD';

create temp table mad_balance_merge on commit drop as
  select profile_id, sum(available_amount) as available_amount
  from account_balances
  where currency <> 'MAD'
  group by profile_id;

insert into account_balances (profile_id, currency, available_amount)
select profile_id, 'MAD', 0
from mad_balance_merge
on conflict (profile_id, currency) do nothing;

update account_balances ab
set available_amount = ab.available_amount + merge.available_amount
from mad_balance_merge merge
where ab.profile_id = merge.profile_id and ab.currency = 'MAD';

update balance_ledger_entries entry
set account_balance_id = mad_balance.id,
    currency = 'MAD'
from account_balances mad_balance
where entry.profile_id = mad_balance.profile_id
  and mad_balance.currency = 'MAD'
  and entry.currency <> 'MAD';

delete from account_balances where currency <> 'MAD';

alter table ticket_categories
  drop constraint if exists ticket_categories_currency_mad,
  add constraint ticket_categories_currency_mad check (currency = 'MAD');

alter table purchases
  drop constraint if exists purchases_currency_mad,
  add constraint purchases_currency_mad check (currency = 'MAD');

alter table resale_listings
  drop constraint if exists resale_listings_currency_mad,
  add constraint resale_listings_currency_mad check (currency = 'MAD');

alter table account_balances
  drop constraint if exists account_balances_currency_mad,
  add constraint account_balances_currency_mad check (currency = 'MAD');

alter table balance_ledger_entries
  drop constraint if exists balance_ledger_entries_currency_mad,
  add constraint balance_ledger_entries_currency_mad check (currency = 'MAD');
