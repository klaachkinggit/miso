-- Compensating release for a consumed promo use.
--
-- increment_promo_use() is called at checkout-initiation, before the Stripe
-- PaymentIntent is created and the marketplace_payment_items are inserted. If
-- any of those subsequent steps throw, the checkout aborts and reserved tickets
-- are released — but the consumed use would otherwise leak, permanently
-- inflating used_count and exhausting a capped code after fewer than max_uses
-- real redemptions. The catch path calls this to return the use to the pool.
--
-- Floored at 0 so a double-release (defensive) can never drive used_count
-- negative. SECURITY DEFINER, locked to service_role like increment_promo_use.
create or replace function public.decrement_promo_use(promo_id uuid)
returns setof promo_codes
language sql
security definer
set search_path = public
as $$
  update promo_codes
     set used_count = greatest(used_count - 1, 0)
   where id = promo_id
  returning *;
$$;

revoke execute on function public.decrement_promo_use(uuid) from public, anon, authenticated;
grant execute on function public.decrement_promo_use(uuid) to service_role;
