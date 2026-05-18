-- Migration 0018 — Remove account balance ledger.
--
-- Payments now go through Stripe Checkout Sessions directly. The account
-- balance ledger (account_balances, balance_ledger_entries) is no longer used.

drop function if exists account_balance_credit(uuid, currency, balance_movement_type, numeric, text, text);
drop function if exists account_balance_debit(uuid, currency, balance_movement_type, numeric, text, text);
drop function if exists assert_balance_holder(uuid);

drop table if exists balance_ledger_entries;
drop table if exists account_balances;

drop type if exists balance_movement_type;
