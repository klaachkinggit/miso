-- Migration 0014 — chain_ops is service-role only.
--
-- The previous policy granted full access to any authenticated admin
-- profile. chain_ops carries in-flight chain state that nothing on the
-- client should ever mutate; admin debugging happens via Supabase
-- Studio (service-role) or the audit log. Drop the policy entirely —
-- with RLS enabled and no policy, anon/authenticated clients get a
-- silent zero-row view. The service-role key bypasses RLS as usual.

drop policy if exists "chain_ops_admin_all" on chain_ops;

-- Defense-in-depth: revoke direct table privileges from anon /
-- authenticated. The PostgREST gateway will still 401 because there's
-- no policy; this just makes the grant matrix match the intent.
revoke all on chain_ops from anon, authenticated;
