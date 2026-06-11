-- Migration 0018 — atomic RPC helpers for Stripe marketplace state.
--
-- Adds:
--   * apply_stripe_account_snapshot: single-statement upsert that
--     preserves operator-set risk states (`owes_recovery`, `blocked`)
--     even when a late account.updated webhook arrives. Eliminates the
--     read-then-write TOCTOU in the application code.
--
-- Both helpers are SECURITY DEFINER and locked to service_role.

create or replace function apply_stripe_account_snapshot(
  p_user_id uuid,
  p_stripe_account_id text,
  p_charges_enabled boolean,
  p_payouts_enabled boolean,
  p_details_submitted boolean,
  p_disabled_reason text,
  p_requirements_json jsonb
) returns stripe_seller_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  result stripe_seller_accounts;
  is_ready boolean := coalesce(p_charges_enabled, false) and coalesce(p_payouts_enabled, false);
begin
  insert into stripe_seller_accounts (
    user_id, stripe_account_id, charges_enabled, payouts_enabled,
    details_submitted, disabled_reason, requirements_json,
    seller_risk_status, last_webhook_at
  ) values (
    p_user_id, p_stripe_account_id, coalesce(p_charges_enabled, false),
    coalesce(p_payouts_enabled, false), coalesce(p_details_submitted, false),
    p_disabled_reason, p_requirements_json,
    case when is_ready then 'clear'::seller_risk_status else 'restricted'::seller_risk_status end,
    now()
  )
  on conflict (user_id) do update set
    stripe_account_id   = excluded.stripe_account_id,
    charges_enabled     = excluded.charges_enabled,
    payouts_enabled     = excluded.payouts_enabled,
    details_submitted   = excluded.details_submitted,
    disabled_reason     = excluded.disabled_reason,
    requirements_json   = excluded.requirements_json,
    last_webhook_at     = now(),
    seller_risk_status  = case
      when stripe_seller_accounts.seller_risk_status in ('owes_recovery','blocked')
        then stripe_seller_accounts.seller_risk_status
      when is_ready and stripe_seller_accounts.seller_risk_status = 'restricted'
        then 'clear'::seller_risk_status
      when not is_ready and stripe_seller_accounts.seller_risk_status = 'clear'
        then 'restricted'::seller_risk_status
      else stripe_seller_accounts.seller_risk_status
    end
  returning * into result;
  return result;
end $$;

revoke execute on function apply_stripe_account_snapshot(uuid, text, boolean, boolean, boolean, text, jsonb)
  from public, anon, authenticated;
grant execute on function apply_stripe_account_snapshot(uuid, text, boolean, boolean, boolean, text, jsonb)
  to service_role;
