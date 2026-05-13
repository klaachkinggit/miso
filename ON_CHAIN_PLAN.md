# Miso On-Chain Implementation Plan

Source of truth for the `on-chain-implementation` branch. This file
captures every decision locked during planning so the work survives
context compaction.

## Goal

Replace synthetic ticket issuance with real ERC-721 mints on Base
Sepolia (chain 84532) via Thirdweb. Every user gets a Thirdweb In-App
Wallet smart account pregenerated from their email. The backend signs
all on-chain operations; users never sign anything.

## Architectural decisions (locked)

| Topic | Decision | Notes |
|-------|----------|-------|
| Chain | Base Sepolia (84532) this iteration; mainnet flip later via env | Free Sepolia ETH from faucet |
| Token standard | ERC-721, one tokenId per ticket | Unique per ticket; matches existing `nft_asset_address` model |
| Contract topology | One `MisoTicket` contract deployed per event | Deploy at event create; address stored on `events.nft_contract_address` |
| Wallet provider | Thirdweb In-App Wallet, pregenerated keyed on email | Backend never signs as user; user never signs anything |
| Trust model | **Pure-admin / issuer-controlled** | Backend wallet has MINTER + METADATA + ADMIN_TRANSFER roles. Document trust assumption explicitly. |
| Gas model | Backend wallet pays all gas | Sepolia ETH from faucet (free). On mainnet later: MAD ticket-price markup amortizes real gas cost. |
| Paymaster / AA | **Not used** | All txs signed by backend EOA. No session keys, no user-side signing, no smart-account UserOp. |
| Payment rail | MAD-only ledger (existing Account Balance) | No stablecoin / on-chain payment in this iter |
| Metadata | Event image pre-uploaded to IPFS via Thirdweb Storage at event create; ticket metadata JSON uploaded at mint time | Image referenced via `event.image_ipfs_uri` |
| Redemption | DB flag (existing `markTicketRedeemed`) PLUS on-chain `redeemed=true` attribute write | Attribute set by backend via `setAttribute` on contract (METADATA_ROLE) |
| Resale transfer | Backend calls `adminTransfer(seller, buyer, tokenId)` on contract (ADMIN_TRANSFER_ROLE) | Seller authorization captured at listing creation off-chain (existing flow) |
| Existing custodial Solana wallets | Drop entire Solana stack | `wallets` table migrates to EVM-only |
| Existing demo data | Wipe + re-seed | Demo branch was already throwaway |
| Branch | `on-chain-implementation` off `development` | Created |
| Thirdweb API style | "Path 2" — `https://api.thirdweb.com` Transactions API, auth via `x-secret-key` header | No separate Engine instance / access token |

## Contract: `MisoTicket`

Custom minimal ERC-721 deployed per event.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MisoTicket is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant METADATA_ROLE = keccak256("METADATA_ROLE");
    bytes32 public constant ADMIN_TRANSFER_ROLE = keccak256("ADMIN_TRANSFER_ROLE");

    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => mapping(string => string)) public attributes;

    event AttributeSet(uint256 indexed tokenId, string key, string value);
    event AdminTransfer(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(string memory name_, string memory symbol_, address admin)
        ERC721(name_, symbol_)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(METADATA_ROLE, admin);
        _grantRole(ADMIN_TRANSFER_ROLE, admin);
    }

    function mintTo(address to, uint256 tokenId, string calldata uri)
        external onlyRole(MINTER_ROLE)
    {
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function setAttribute(uint256 tokenId, string calldata key, string calldata value)
        external onlyRole(METADATA_ROLE)
    {
        _requireOwned(tokenId);
        attributes[tokenId][key] = value;
        emit AttributeSet(tokenId, key, value);
    }

    function adminTransfer(address from, address to, uint256 tokenId)
        external onlyRole(ADMIN_TRANSFER_ROLE)
    {
        require(ownerOf(tokenId) == from, "wrong owner");
        _transfer(from, to, tokenId);
        emit AdminTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

Backend wallet `0x1860Ef4CdB6EFf2E06C9D3cC4b6530eb2822bAC5` = `admin`
constructor arg → receives all four roles on every deployed contract.

Contract source lives in `contracts/MisoTicket.sol`. Compiled bytecode
shipped via Thirdweb's "publish & deploy from bytecode" endpoint.

## Required env vars

```
THIRDWEB_CLIENT_ID=ee03722dd0b022e45fd07e0381e5a730
THIRDWEB_SECRET_KEY=<rotated, server-only, .env.local>
THIRDWEB_API_URL=https://api.thirdweb.com
THIRDWEB_BACKEND_WALLET_ADDRESS=0x1860Ef4CdB6EFf2E06C9D3cC4b6530eb2822bAC5
CHAIN_ID=84532
```

Drop: `WALLET_ENCRYPTION_KEY` (no more local custodial keys), any
Solana RPC / cluster vars.

## Phased delivery — commit per phase

### Phase 0 — Docs + branch (this commit)
- Create `on-chain-implementation` branch off `development` ✓
- Write `ON_CHAIN_PLAN.md` (this file)
- Rewrite `PLAN.md` (demo-branch → on-chain pivot summary)
- Update `docs/CONTEXT.md` domain language additions

### Phase 1 — Dependencies + env
- Remove Solana deps:
  `@solana/wallet-adapter-*`, `@solana/web3.js`, `@metaplex-foundation/*`,
  `bs58`, `tweetnacl`
- Add Thirdweb deps:
  `thirdweb` (v5 SDK for IPFS upload + types), `viem` (for contract
  ABI encoding), no separate Engine SDK (direct REST via `fetch`)
- Update `.env.example`: drop Solana + `WALLET_ENCRYPTION_KEY`, add
  Thirdweb vars above
- Update `next.config.ts` if any Solana-specific webpack config exists
- **Commit**: `deps: swap Solana stack for Thirdweb`

### Phase 2 — Database schema migration
New Supabase migration `00XX_evm_schema.sql`:

```sql
-- events
alter table events rename column solana_collection_address to nft_contract_address;
alter table events add column image_ipfs_uri text;

-- tickets
alter table tickets rename column nft_asset_address to nft_token_id;
alter table tickets add column mint_tx_hash text;
alter table tickets rename column owner_wallet_address to owner_evm_address;
alter table tickets rename column redeem_tx_signature to redeem_tx_hash;
alter table tickets drop column redemption_pda;

-- wallets
alter table wallets drop column encrypted_secret_key;
alter table wallets drop column wallet_type;
alter table wallets rename column wallet_address to evm_address;
alter table wallets add column smart_account_address text;
```

- Wipe demo data: `truncate tickets, ticket_categories, events, gate_sessions, ticket_redemptions, resale_listings, purchases, balance_ledger_entries, account_balances cascade`
- Regenerate `src/types/db.ts`
- Update seed script `scripts/seed.ts` for new column names + drop
  Solana keypair generation
- **Commit**: `db: migrate schema to EVM identifiers`

### Phase 3 — Wallet service via Thirdweb pregenerate
- Delete `src/lib/solana/` (whole directory)
- Delete `src/lib/crypto/aes.ts` (no more local secrets)
- New `src/lib/thirdweb/client.ts`: shared fetch wrapper with secret key header
- New `src/lib/thirdweb/wallet.ts`:
  - `ensureUserWallet(userId, email)`:
    - Look up `wallets` row → return if exists
    - Call Thirdweb pregenerate-wallet endpoint:
      `POST /v1/wallets/user`
      body: `{ strategy: "email", email, chainId: 84532 }`
      → returns `{ address, smartAccountAddress }`
    - Persist `(user_id, evm_address, smart_account_address)`
    - Return `{ evmAddress, smartAccountAddress }`
- Hook into Supabase auth signup callback (server-side) +
  defensive call from purchase path
- Drop all imports of `ensureCustodialWallet`; replace with
  `ensureUserWallet`
- **Commit**: `wallet: replace custodial Solana with Thirdweb In-App pregenerate`

### Phase 4 — Engine client + Storage wrapper
- `src/lib/thirdweb/transactions.ts`:
  - `deployContract({ contractBytecode, abi, constructorArgs, chainId })`
    → returns `{ transactionId, contractAddress, txHash }`
  - `writeContract({ contractAddress, abi, functionName, args, chainId })`
    → returns `{ transactionId, txHash }`
  - `waitForTransaction(transactionId, { timeoutMs })`
    → polls Thirdweb status endpoint until `mined` or fails
  - All requests use `x-secret-key: ${THIRDWEB_SECRET_KEY}` +
    `x-backend-wallet-address: ${THIRDWEB_BACKEND_WALLET_ADDRESS}`
- `src/lib/thirdweb/storage.ts`:
  - `uploadJson(metadata)` → returns `ipfs://...` URI
  - `uploadFile(buffer, mime)` → returns `ipfs://...` URI
  - Uses Thirdweb Storage REST (`/ipfs/upload`)
- `src/lib/thirdweb/contracts/misoTicket.ts`:
  - Compiled ABI + bytecode (artifact from Foundry or Hardhat compile of `contracts/MisoTicket.sol`)
  - Typed helper functions: `mintTo`, `setAttribute`, `adminTransfer`,
    `ownerOf`, `tokenURI`
- Unit tests `src/lib/thirdweb/__tests__/`:
  - msw-mocked Thirdweb API responses
  - Idempotency: re-call after success doesn't double-submit
  - Failure: 4xx surfaces as typed error
- **Commit**: `engine: typed Thirdweb Transactions API + IPFS Storage client`

### Phase 5 — Event creation deploys contract
- `src/lib/events/setup.ts` (or wherever event-create lives):
  - On admin "publish event":
    1. If `event.image_url` present and not yet IPFS-pinned:
       upload bytes → `event.image_ipfs_uri = ipfs://...`
    2. Deploy `MisoTicket` via Transactions API:
       `name = event.name`, `symbol = "MISO"`, `admin = backend wallet`
    3. Wait for deploy → persist `event.nft_contract_address`
    4. Audit-log deploy tx hash
  - Idempotent: skip deploy if `nft_contract_address` already set
- Update admin UI to show contract address + basescan link on event
  detail page
- **Commit**: `events: deploy MisoTicket ERC-721 contract per event`

### Phase 6 — Ticket fulfillment = real mint
- Replace `fulfillReservedTicket` in `src/lib/tickets/lifecycle.ts`:
  1. Load event → `nft_contract_address` required
  2. Load buyer wallet → `ensureUserWallet(buyer)` → smartAccountAddress
  3. Build metadata JSON:
     ```json
     {
       "name": "<event.name> — Ticket #<serial>",
       "description": "<event.description>",
       "image": "<event.image_ipfs_uri>",
       "attributes": [
         {"trait_type": "Event", "value": "<event.name>"},
         {"trait_type": "Category", "value": "<category.name>"},
         {"trait_type": "Serial", "value": <serial>},
         {"trait_type": "Redeemed", "value": "false"}
       ]
     }
     ```
  4. Upload metadata to IPFS → `metadataUri`
  5. Generate `tokenId` (use ticket serial number as deterministic id —
     unique per contract since one contract per event)
  6. Call `mintTo(contract, smartAccountAddress, tokenId, metadataUri)`
     via Engine → get `txHash`
  7. Wait for mined
  8. Persist on ticket row:
     `status='sold'`, `nft_token_id=<tokenId>`, `mint_tx_hash=<txHash>`,
     `metadata_uri=<ipfs uri>`, `owner_evm_address=<smartAccountAddress>`,
     `minted_at=now()`, `original_purchase_id`
- Failure path: throw → existing balance settlement compensates buyer
  via credit (existing behavior — verify still works)
- **Commit**: `tickets: mint ERC-721 on fulfillment`

### Phase 7 — Redemption on-chain attribute
- In `redeemTicket` flow (gate redemption route):
  - After DB flip succeeds, fire `setAttribute(contract, tokenId, "Redeemed", "true")` via Engine
  - Wait for mined → persist `redeem_tx_hash` on ticket
  - On failure: redemption stays DB-marked redeemed, attribute write
    can be retried by admin tool (compensating idempotent op).
    Log to audit.
- Idempotent: re-call `setAttribute` after success = no-op (contract
  just overwrites — same value).
- **Commit**: `redemption: write redeemed attribute on chain`

### Phase 8 — Resale on-chain transfer
- `fulfillResale` (in `src/lib/resale/listing.ts` or sibling):
  - Load seller wallet, buyer wallet, ticket contract + tokenId
  - Engine `adminTransfer(contract, seller, buyer, tokenId)`
  - Wait for mined → persist `transfer_tx_hash` on ticket (new col? or
    overload `mint_tx_hash` — recommend new col `last_transfer_tx_hash`)
  - DB ownership update happens after on-chain transfer mined
- Schema follow-up migration in same phase: add
  `tickets.last_transfer_tx_hash text`
- **Commit**: `resale: admin-transfer on chain via ADMIN_TRANSFER_ROLE`

### Phase 9 — Tests
- `tests/` Playwright e2e:
  - Add msw server in `tests/setup.ts` to intercept
    `https://api.thirdweb.com/*` and return deterministic mocked tx
    responses
  - Update existing e2e specs to assert that ticket rows now have
    non-null `mint_tx_hash`, `nft_token_id`
- Unit tests for `thirdweb/wallet.ts`, `thirdweb/transactions.ts`,
  `thirdweb/storage.ts`
- Live Sepolia smoke test `tests/live-chain.spec.ts`:
  - Gated by `LIVE_CHAIN=true` env (skipped in CI by default)
  - Deploys real contract → mints → reads tokenURI → asserts ownership
- Document in `tests/README.md` how to run live mode
- **Commit**: `tests: cover on-chain mint, redeem, transfer paths`

### Phase 10 — Cleanup + final docs
- Delete `src/lib/demo/artifacts.ts` (no synthetic ids anywhere)
- Grep `demo_asset_`, `demo_redeem_`, `demo_attr_`, etc. — remove
  references in code, comments, tests
- Final pass over `docs/CONTEXT.md`:
  - Drop demo-branch language ("synthetic asset ids", "no real chain")
  - Add new terms: Smart Account, Token Id, Contract Address, Mint, IPFS Metadata, Admin Transfer
  - Update lifecycle diagram if needed
- Final pass over `PLAN.md` to reflect shipped state
- **Commit**: `cleanup: remove demo artifacts and finalize domain docs`

## Open questions / future iterations

Not in scope but document for future:
- Mainnet flip — env-only change to `CHAIN_ID=8453` once funded
- Paymaster + AA — re-enable if user-side signing ever needed (e.g.
  trustless resale via session keys)
- Stablecoin payment rail (USDC) — replaces MAD ledger for crypto-
  native buyers
- Wallet recovery — currently relies on Thirdweb's email OTP; document
  custody assumptions for users
- Contract upgradeability — current `MisoTicket` is immutable; no
  proxy. Acceptable for ticketing.

## Trust assumptions to document in CONTEXT.md

- Backend wallet `0x1860...` has unilateral mint, metadata, and
  transfer authority on every event contract. Compromise of this key
  = full takeover of all Miso tickets.
- User In-App Wallets are pregenerated and controlled by Thirdweb's
  infra against the user's email. Users do not sign on chain in v1.
- "Ownership on chain" reflects DB ownership eventually, not
  instantaneously. The chain is a derived public log, not the source
  of truth.
