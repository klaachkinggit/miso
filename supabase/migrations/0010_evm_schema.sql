-- Migration 0010 — EVM schema swap.
--
-- Replaces synthetic Solana identifiers with real on-chain ERC-721 fields.
-- Demo data is wiped first; the demo branch had no production rows.
--
-- After this migration:
--   events.nft_contract_address  text  -- deployed MisoTicket per event
--   events.image_ipfs_uri        text  -- event image pinned to IPFS
--   tickets.nft_contract_address text  -- copy of event's contract for fast lookup
--   tickets.nft_token_id         bigint -- on-chain ERC-721 tokenId
--   tickets.mint_tx_hash         text
--   tickets.redeem_tx_hash       text
--   tickets.metadata_uri         text  -- ipfs://... (existing column, semantics tightened)
--   tickets.owner_evm_address    text  -- buyer smart-account address
--   wallets.evm_address          text  -- EOA from Thirdweb In-App Wallet
--   wallets.smart_account_address text -- smart account that owns NFTs

-- ===== Wipe demo data =======================================================
truncate table
  balance_ledger_entries,
  account_balances,
  ticket_redemptions,
  gate_sessions,
  resale_listings,
  purchases,
  tickets,
  ticket_categories,
  event_controllers,
  events,
  wallets,
  audit_logs
restart identity cascade;

-- ===== tickets ==============================================================
drop index if exists tickets_redeem_tx_signature_uniq;
drop index if exists tickets_redemption_pda_uniq;

alter table tickets drop column if exists nft_asset_address;
alter table tickets drop column if exists redemption_pda;
alter table tickets drop column if exists redeemed_wallet_address;

alter table tickets rename column owner_wallet_address to owner_evm_address;
alter table tickets rename column redeem_tx_signature to redeem_tx_hash;

alter table tickets
  add column nft_contract_address text,
  add column nft_token_id bigint,
  add column mint_tx_hash text;

create unique index tickets_mint_tx_hash_uniq
  on tickets(mint_tx_hash) where mint_tx_hash is not null;
create unique index tickets_redeem_tx_hash_uniq
  on tickets(redeem_tx_hash) where redeem_tx_hash is not null;
create unique index tickets_contract_token_uniq
  on tickets(nft_contract_address, nft_token_id)
  where nft_contract_address is not null and nft_token_id is not null;

-- ===== events ===============================================================
alter table events rename column solana_collection_address to nft_contract_address;
alter table events add column image_ipfs_uri text;

-- ===== wallets ==============================================================
-- encrypted_secret_key had a column-level revoke; dropping the column drops it.
alter table wallets drop column if exists encrypted_secret_key;
alter table wallets drop column if exists wallet_type;
alter table wallets rename column wallet_address to evm_address;
alter table wallets add column smart_account_address text;

create unique index wallets_smart_account_uniq
  on wallets(smart_account_address) where smart_account_address is not null;

drop type if exists wallet_type;

-- ===== ticket_redemptions ===================================================
drop index if exists redemptions_tx_signature_uniq;
drop index if exists redemptions_pda_uniq;

alter table ticket_redemptions drop column if exists redemption_pda;
alter table ticket_redemptions drop column if exists signature;

alter table ticket_redemptions rename column wallet_address to evm_address;
alter table ticket_redemptions rename column redeem_tx_signature to redeem_tx_hash;

create unique index redemptions_redeem_tx_hash_uniq
  on ticket_redemptions(redeem_tx_hash) where redeem_tx_hash is not null;
