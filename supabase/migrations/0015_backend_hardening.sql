-- Migration 0015 — backend hardening.
--
-- 1. Balance RPCs are SECURITY DEFINER and must be reachable ONLY from
--    the service-role API surface. Default PostgREST grants `EXECUTE`
--    to PUBLIC for any `create function`, so an authenticated user
--    could otherwise call them directly with arbitrary `p_profile_id`
--    and forge credits or debits.
-- 2. gate_sessions: the controller_update policy let a controller
--    update arbitrary columns on a gate row they own (including
--    event_id, opened_at, etc.). All gate mutations go through the
--    server API on the service-role client. Drop the policy so direct
--    client writes are impossible.
-- 3. tickets: the public `tickets_listed_public_select` policy
--    exposed every column (owner_user_id, owner_evm_address,
--    metadata_uri, etc.) of any ticket whose status was `listed`.
--    Marketplace pages render through server components that use the
--    service-role client and pick what they need; drop the public
--    policy so anon clients can't scrape ticket PII.
-- 4. Defense-in-depth: revoke direct grants on chain_ops + raw RPC
--    surfaces. Service-role bypasses RLS / grants as usual.

-- ===== 1. Lock down balance RPCs ===========================================
revoke execute on function account_balance_credit(
  uuid, currency, balance_movement_type, numeric, text, text
) from public, anon, authenticated;
grant execute on function account_balance_credit(
  uuid, currency, balance_movement_type, numeric, text, text
) to service_role;

revoke execute on function account_balance_debit(
  uuid, currency, balance_movement_type, numeric, text, text
) from public, anon, authenticated;
grant execute on function account_balance_debit(
  uuid, currency, balance_movement_type, numeric, text, text
) to service_role;

revoke execute on function assert_balance_holder(uuid) from public, anon, authenticated;
grant execute on function assert_balance_holder(uuid) to service_role;

-- ===== 2. gate_sessions: server-only writes ================================
drop policy if exists "gate_sessions_controller_update" on gate_sessions;
drop policy if exists "gate_sessions_controller_insert" on gate_sessions;
-- Selects stay: controllers see their own, admin sees all. All
-- inserts/updates flow through the server with service-role.

-- ===== 3. tickets: drop wide-open public select ============================
drop policy if exists "tickets_listed_public_select" on tickets;

-- ===== 4. Belt-and-suspenders revoke =======================================
-- chain_ops was already revoked in 0014; redo here in case a fresh DB
-- starts at 0015 alone (idempotent).
revoke all on chain_ops from anon, authenticated;
