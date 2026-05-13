# Miso Domain Context — On-Chain Implementation

Domain-specific terminology and concepts for the `on-chain-implementation`
branch. Miso issues real ERC-721 tickets on Base Sepolia via Thirdweb,
under an **issuer-controlled trust model** where the backend wallet
holds all mint, metadata, and transfer roles. Users hold tickets at
their pregenerated In-App Wallet smart-account addresses but do not
sign on chain in this iteration.

For the previous synthetic demo language, see git history on the
`development` or `feature-account-linked-balance` branches.

## On-chain stack additions

| Term | Definition |
|------|-----------|
| **Chain** | Base Sepolia (chain id `84532`) in this iteration; Base mainnet (`8453`) is a future env flip. |
| **MisoTicket contract** | Custom minimal ERC-721 deployed per Event with `MINTER_ROLE`, `METADATA_ROLE`, and `ADMIN_TRANSFER_ROLE`. Source in `contracts/MisoTicket.sol`. |
| **Contract address** | The deployed MisoTicket address for a given Event, persisted in `events.nft_contract_address`. |
| **Token id** | The on-chain ERC-721 tokenId for a given Ticket. Deterministically equal to the Ticket's serial number within its Event contract. Persisted in `tickets.nft_token_id`. |
| **Smart account** | The user's Thirdweb In-App Wallet smart-account address, pregenerated keyed on email. Owns NFTs on chain. Persisted in `wallets.smart_account_address`. |
| **Backend wallet** | The single Thirdweb Server Wallet (`0x1860Ef4CdB6EFf2E06C9D3cC4b6530eb2822bAC5`) that signs every on-chain transaction Miso performs. |
| **Mint** | The on-chain action where the backend wallet calls `mintTo(smartAccount, tokenId, metadataUri)` on the Event's MisoTicket contract, granting on-chain ownership to the buyer. Performed exactly once per Ticket at fulfillment. |
| **Admin transfer** | The on-chain action where the backend wallet calls `adminTransfer(seller, buyer, tokenId)` to move an existing Ticket to a new owner during resale. Authorized off-chain by the seller via marketplace listing creation. |
| **Redeemed attribute** | The on-chain key/value `Redeemed=true` written via `setAttribute` after a Ticket is redeemed at a Gate. Complements the off-chain `tickets.status='used'` flag. |
| **Metadata IPFS URI** | Ticket metadata JSON pinned to IPFS via Thirdweb Storage at mint time; persisted in `tickets.metadata_uri`. |
| **Event image IPFS URI** | Event image pinned to IPFS at event publish; persisted in `events.image_ipfs_uri` and referenced by every Ticket's metadata. |
| **Mint tx hash** | The Base-Sepolia transaction hash of a Ticket's `mintTo` call. Persisted in `tickets.mint_tx_hash`. |
| **Redeem tx hash** | The transaction hash of the `setAttribute("Redeemed","true")` call. Persisted in `tickets.redeem_tx_hash`. |
| **Issuer-controlled trust** | The architectural assumption that Miso (via the backend wallet) is the sole authority for mint, metadata, and transfer operations. Compromise of the backend wallet = full takeover of all tickets. Acceptable for v1 ticketing where the issuer is already a central authority. |

## Domain language (carry-over from off-chain layer)

## Language

| Term | Definition |
|------|-----------|
| **Ticket** | A row in `tickets` representing one festival entry. Each Ticket has a real on-chain ERC-721 token under its Event's MisoTicket contract; `tickets.nft_token_id` references the on-chain tokenId. |
| **Holder** | The user that owns the ticket. Identified by `owner_user_id`; the buyer's smart-account address is in `owner_evm_address`. |
| **Collection** | The set of tickets for an event. The Event's `nft_contract_address` is the deployed MisoTicket contract on Base Sepolia. |
| **Gate** | A `gate_sessions` row, opened by a controller at the venue. The gate's short code is a navigation link only — it is not enough to enter on its own. |
| **Gate operations** | The controller-facing actions and queries for Gates, including opening, listing, polling, closing, and the admin/controller authorization rules for each operation. |
| **Redemption** | The act of consuming a ticket at a gate. Records a row in `ticket_redemptions`, flips the ticket from `sold` to `used`. |
| **Ticket lifecycle** | The allowed status changes for a Ticket, including the guarded database writes and timestamp/cleanup fields that make each transition valid. |
| **Event setup** | The admin-owned mutations that prepare an Event for sale: draft creation, synthetic Collection assignment, Category creation, Ticket seeding, inventory cancellation, and publish state. |
| **Purchase settlement** | The balance-backed decision that turns a pending purchase outcome into Purchase and Ticket lifecycle changes. |
| **Balance settlement** | The debit-first decision that reserves Account Balance credit before fulfilling a ticket or resale purchase, with automatic compensating credit if fulfillment fails. |
| **External funding rail** | The out-of-scope real-money boundary where a Holder would charge or cash out Account Balance; it may be visible in UI but must fail as not implemented while intra-app settlement uses real ledger movement. |
| **Account Balance** | Internal demo MAD credit linked to a buyer/admin profile, stored as the current available amount and used for all demo checkout flows, resale settlement, and refunds. |
| **Balance Ledger Entry** | An immutable audit record of one Account Balance movement, such as an admin demo top-up, seeded balance, purchase debit, resale seller credit, or refund credit. |
| **Tx hash** | A Base-Sepolia transaction hash returned by Thirdweb after a mint, attribute write, or admin transfer. Persisted on the Ticket row. |

Terms to avoid:
- "Token" without qualifier (ambiguous: NFT vs. auth token; prefer "Token id" or "NFT").
- "User" without a role (`buyer`, `controller`, `admin`).
- "Solana", "PDA", "mpl-core", "Umi", "custodial keypair" — all removed in this branch. Tickets live on Base.
- "Demo asset", "synthetic id", "demo signature" — removed in this branch. All identifiers are real on-chain values.

## Relationships

- Event (1) → Tickets (N)
- Event (1) → Categories (N) → Tickets (N)
- Event (1) → MisoTicket Contract (1) — deployed at event publish; persists `nft_contract_address`.
- Ticket (1) → Holder (1) — transferable only via resale (admin-transfer on chain).
- Ticket (1) → Token id (1) — deterministic per Ticket within its Event contract.
- Holder (1) → Smart Account (1) — pregenerated by Thirdweb In-App Wallet keyed on email; persisted in `wallets.smart_account_address`.
- Event (1) → Gates (N) — opened by controllers, navigated to by buyers.
- Holder (1) → Account Balance (1) — at most one MAD balance when demo credit exists.
- Account Balance (1) → Balance Ledger Entries (N) — balances are derived from immutable movements.

## Lifecycle (Ticket Status)

`available` → `reserved` → `sold` → `used`
                              ↘ `listed` → `sold` (via resale)
                              ↘ `refund_pending` → `refunded`
                              ↘ `canceled` / `expired`

## Flagged Ambiguities

- **"Transfer"**: a Ticket changes hands via on-chain `adminTransfer(seller, buyer, tokenId)` on the Event's MisoTicket contract, executed by the backend wallet (`ADMIN_TRANSFER_ROLE`). The seller authorizes this off-chain at listing creation; there is no user-side signature on chain.
- **"On-chain"**: real Base Sepolia transactions. Every mint, attribute write, and admin transfer is a real, basescan-verifiable tx signed by the backend wallet.
- **"Sold" vs. Account Balance**: `sold` is a Ticket status, not a money balance. Use **Account Balance** for internal MAD credit.
- **"Account Balance" vs. Smart Account**: Account Balance is MAD credit only (off-chain). Smart Account holds the user's on-chain NFTs and never directly holds spendable money.
- **"Deposit" / "withdrawal"**: real-money movement is out of scope for this implementation; charge and cashout belong to the **External funding rail** and may appear in UI, but actions must fail as not implemented while intra-app transactions use real ledger movement.
- **"Demo top-up"**: only admins and seed data can grant Account Balance credit; buyers do not self-fund their balances in this branch.
- **"Admin top-up"**: admins grant Account Balance credit from the admin area by choosing a holder and MAD amount.
- **"Top-up direction"**: admin top-up only adds Account Balance credit in this branch; admin correction debits are out of scope.
- **"Seeded balance"**: demo seed data grants starting Account Balance credit to demo buyers, while at least one demo seller starts with zero balance so resale seller credit is visible.
- **"Stored balance vs. ledger"**: Account Balance stores the fast current amount, while Balance Ledger Entries preserve the immutable audit trail; every movement updates both together.
- **"Ledger idempotency"**: Balance Ledger Entries are unique per business operation reference so checkout retries cannot duplicate debits, credits, refunds, or compensating entries.
- **"Ledger movement types"**: Balance Ledger Entries use a strict movement vocabulary: `seed_credit`, `admin_topup_credit`, `purchase_debit`, `resale_buyer_debit`, `resale_seller_credit`, `refund_credit`, and `compensation_credit`.
- **"Ledger entry shape"**: Balance Ledger Entries store only the minimum structured audit fields: balance/profile identity, `movement_type`, `amount`, `currency`, business operation reference, and creation time; display labels are generated by the app.
- **"Ledger amount direction"**: Balance Ledger Entry amounts are stored as positive values; the movement type determines whether the movement credits or debits Account Balance.
- **"Money representation"**: Account Balance and Balance Ledger Entry amounts use `numeric(12,2)`, matching existing ticket, purchase, and resale prices in this branch.
- **"Currency"**: all ticket prices, resale listings, purchases, Account Balances, and Balance Ledger Entries are MAD-only in this branch.
- **"Balance service"**: all Account Balance movements go through one server-side balance service; checkout, resale, refunds, admin top-up, and seed logic do not write balances directly.
- **"Balance atomicity"**: balance movements are enforced by database functions that lock the Account Balance row, reject overdrafts, update the stored balance, and insert the idempotent Balance Ledger Entry in one transaction.
- **"Balance settlement"**: in-app purchases debit Account Balance before Ticket fulfillment; fulfillment failures automatically credit the buyer back and release the reservation where possible. This is not a mock payment.
- **"Demo checkout rail"**: primary ticket purchase, resale purchase, resale seller credit, and refunds all settle through Account Balance in this branch.
- **"Mock payment"**: mock behavior belongs only at the External funding rail for future charge/cashout flows, not inside intra-app transactions.
- **"Account Balance UI"**: buyers see Account Balance in the header/user menu and on a dedicated balance page with ledger history plus unavailable charge/cashout actions.
- **"Controllers and balance"**: controllers are venue control operators, not buyers; they cannot hold or spend Account Balance in this branch.
- **"Admins and balance"**: admins can hold and spend Account Balance for testing and demo support, and can grant admin top-ups to eligible holders.
- **"External funding UI"**: charge and cashout actions call stable API routes that return `501 Not Implemented` and do not create Balance Ledger Entries.
- **"Ledger visibility"**: holders can see their own full Balance Ledger Entry history; admins can see Balance Ledger Entries for every holder.
- **"Negative balance"**: Account Balances cannot go negative; purchases, resale checkout, and admin adjustments fail when they would overdraw the balance.
- **"Insufficient balance UX"**: buyer-facing purchase controls are disabled when the visible Account Balance is insufficient, while server-side balance settlement remains the source of truth.
- **"Resale settlement"**: resale debits the buyer first, transfers the Ticket second, then credits the seller only after transfer succeeds.
- **"Refund recipient"**: Account Balance refunds credit the current Holder, not necessarily the original buyer.
- **"Resale proceeds and refunds"**: seller Account Balance credit is not clawed back if a resold ticket is later refunded or canceled; the current Holder still receives the refund credit.
