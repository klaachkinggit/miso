-- Migration 0016 — Stripe marketplace: enum extensions + legacy MAD-only relaxations.
--
-- Split from the table creation in 0017 because Postgres forbids using a
-- newly added enum value in the same transaction that added it. Running
-- the ALTER TYPE statements in their own migration commits them first.
--
-- Notes:
--   * Account Balance tables (legacy MAD-only ledger) keep their
--     `currency = 'MAD'` check. They are retained for historical audit
--     only; new product flows go through Stripe marketplace settlement.
--   * Stripe v1 supports EUR card payments only. MAD remains a legal
--     enum value so existing drafts/data can be read, but checkout for
--     MAD is rejected in application code (see stripe-marketplace).

-- Currency: add EUR alongside MAD.
alter type currency add value if not exists 'EUR';

-- User role: organizer profile that creates Events and receives primary
-- ticket proceeds via Stripe Connect.
alter type user_role add value if not exists 'organizer';

-- Drop MAD-only constraints from money-bearing product tables so EUR
-- prices/purchases/listings can be persisted. Account Balance tables
-- intentionally keep their check.
alter table ticket_categories
  drop constraint if exists ticket_categories_currency_mad;

alter table purchases
  drop constraint if exists purchases_currency_mad;

alter table resale_listings
  drop constraint if exists resale_listings_currency_mad;
