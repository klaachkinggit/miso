-- Migration 0011 — record resale on-chain transfer.
--
-- Adds tickets.last_transfer_tx_hash so a resold ticket carries the
-- adminTransfer tx hash. mint_tx_hash stays pinned to the original
-- mint; last_transfer_tx_hash overwrites on every successful resale.

alter table tickets add column if not exists last_transfer_tx_hash text;

create unique index if not exists tickets_last_transfer_tx_hash_uniq
  on tickets(last_transfer_tx_hash) where last_transfer_tx_hash is not null;
