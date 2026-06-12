-- Link legacy Express-onboarded organizers into the marketplace seller
-- registry. Legacy onboarding (src/lib/payments/stripe-connect.ts) stores
-- Stripe state on profiles.stripe_* only; the marketplace path reads
-- stripe_seller_accounts exclusively, so without this backfill every
-- legacy-onboarded organizer fails assertPayoutReady. Risk status starts
-- 'clear': these accounts completed Stripe-hosted onboarding and their
-- enabled flags carry over; account.updated webhooks keep rows fresh.
insert into stripe_seller_accounts (
  user_id,
  stripe_account_id,
  charges_enabled,
  payouts_enabled,
  details_submitted,
  seller_risk_status
)
select
  p.id,
  p.stripe_account_id,
  coalesce(p.stripe_charges_enabled, false),
  coalesce(p.stripe_payouts_enabled, false),
  coalesce(p.stripe_details_submitted, false),
  'clear'::seller_risk_status
from profiles p
where p.stripe_account_id is not null
  and not exists (
    select 1 from stripe_seller_accounts s where s.user_id = p.id
  )
  and not exists (
    select 1 from stripe_seller_accounts s
    where s.stripe_account_id = p.stripe_account_id
  );
