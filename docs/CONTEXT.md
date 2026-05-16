# Miso Domain Context

Miso is an on-chain ticketing app for event organizers, buyers, sellers,
and gate controllers. Tickets are issued as ERC-721 tokens on Base
Sepolia through Thirdweb while in-app payments settle through a MAD
Account Balance ledger.

## Chain Model

| Term | Definition |
|------|------------|
| Chain | Base Sepolia (`84532`) for the current deployment. Base mainnet (`8453`) is a future env change. |
| MisoTicket contract | Custom ERC-721 deployed per Event. Source lives in `contracts/MisoTicket.sol`. |
| Contract address | Event-specific MisoTicket address stored in `events.nft_contract_address`. |
| Token id | ERC-721 token id for one Ticket. It matches the Ticket serial number within its Event contract and is stored in `tickets.nft_token_id`. |
| Smart account | Thirdweb In-App Wallet smart account generated from a holder email. NFTs are owned by this address and stored in `wallets.smart_account_address`. |
| Backend wallet | Thirdweb Server Wallet that signs deploy, mint, metadata, and admin-transfer transactions. |
| Mint | Backend call to `mintTo(smartAccount, tokenId, metadataUri)` during ticket fulfillment. |
| Admin transfer | Backend call to `adminTransfer(seller, buyer, tokenId)` during resale after off-chain seller authorization. |
| Redeemed attribute | On-chain `Redeemed=true` attribute written after successful gate redemption. |
| Metadata IPFS URI | Ticket metadata JSON pinned through Thirdweb Storage and stored in `tickets.metadata_uri`. |
| Tx hash | Base Sepolia transaction hash stored on the Ticket row after mint, redemption, or transfer. |

## App Model

| Term | Definition |
|------|------------|
| Event | Admin-created sale surface with categories, inventory, controllers, and one deployed MisoTicket contract. |
| Ticket | One festival entry. The database row is the app source of truth; the ERC-721 token is the public on-chain representation. |
| Holder | Profile that owns the Ticket in the app, tracked by `owner_user_id` and `owner_evm_address`. |
| Category | Event ticket tier with MAD price and seeded inventory. |
| Gate | Controller session used to validate and redeem tickets at the venue. |
| Redemption | Gate action that writes a `ticket_redemptions` row, marks the Ticket `used`, and writes the on-chain redeemed attribute. |
| Account Balance | Internal MAD credit used for primary purchases, resale settlement, and refunds. |
| Balance Ledger Entry | Immutable audit row for one Account Balance movement. |
| External funding rail | Charge and cashout boundary for future real-money movement. Current API routes return `501 Not Implemented`. |
| Purchase settlement | Debit-first flow that reserves MAD balance, fulfills a Ticket, and compensates the buyer if fulfillment fails before chain finality. |
| Resale settlement | Debit buyer, transfer Ticket, then credit seller after transfer success. |

## Ticket Lifecycle

`available` -> `reserved` -> `sold` -> `used`

`sold` -> `listed` -> `sold`

`sold` -> `refund_pending` -> `refunded`

`available` -> `canceled`

## Rules

- Controllers can operate gates but cannot buy tickets, list tickets, or use marketplace checkout.
- Account Balances cannot go negative.
- Balance movements go through server-side ledger functions only.
- Checkout retries must be idempotent and must not duplicate debits, mints, credits, or transfers.
- Backend wallet authority is issuer-controlled: compromise of that wallet means compromise of all event contracts it administers.
- User smart accounts hold NFTs, but users do not sign on-chain transactions in the current product model.

## Terms To Avoid

- "Token" without qualifier. Use "NFT", "auth token", or "token id".
- "Solana", "PDA", "mpl-core", "Umi", or "custodial keypair".
