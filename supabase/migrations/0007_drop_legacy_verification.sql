-- Migration 0007 — Drop the legacy code-entry verification flow.
--
-- The verification_challenges table backed the controller-types-a-code flow
-- (entry_code_dialog → /api/verify). That flow is replaced by gate sessions +
-- customer-signed redemption transactions. No live data depends on the table.

drop table if exists verification_challenges;
