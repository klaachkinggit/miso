-- Migration 0012 — new ticket/listing states + per-event role admin.
--
-- Adds in-flight states so a chain op can hold the row before the chain
-- call, plus a `repair_needed` terminal state for "mined on chain but
-- DB write failed" cases that must NOT be compensated.
--
-- New enum values cannot be referenced in the same transaction that
-- created them, so the table/RPC that uses them lives in 0013.

alter type ticket_status add value if not exists 'minting';
alter type ticket_status add value if not exists 'transferring';
alter type ticket_status add value if not exists 'repair_needed';

alter type listing_status add value if not exists 'transferring';
alter type listing_status add value if not exists 'repair_needed';

-- Per-event admin address used to sign mint/transfer/setAttribute.
-- For events deployed before the smart-wallet switch, ops can set this
-- to the original EOA to keep chain writes authorized. Code falls back
-- to backendWallet() when NULL.
alter table events add column if not exists role_admin_address text;
