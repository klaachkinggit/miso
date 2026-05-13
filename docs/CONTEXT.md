# Miso Domain Context — Demo Branch

Domain-specific terminology and concepts for the demo cut of Miso.

## Language

| Term | Definition |
|------|-----------|
| **Ticket** | A row in `tickets` representing one festival entry. In this branch, every ticket is *synthetic*: it has a `nft_asset_address` of the form `demo_asset_<ticket_id>` and no real on-chain counterpart. |
| **Holder** | The user that owns the ticket. Identified by `owner_user_id`; the buyer's custodial wallet address is in `owner_wallet_address`. |
| **Collection** | The set of tickets for an event. The event's `solana_collection_address` is the synthetic id `demo_collection_<event_id>`. |
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
| **Demo artifact** | A synthetic identifier or signature used by the demo branch where production would use on-chain data. Demo artifacts include Ticket asset ids, Collection ids, redemption PDAs, and Demo signatures. |
| **Demo signature** | Synthetic strings returned where a real Solana transaction signature would live: `demo_redeem_*`, `demo_attr_*`, `demo_thaw_*`, `demo_xfer_*`, `demo_refreeze_*`. They have no on-chain meaning. |

Terms to avoid:
- "Token" (ambiguous: NFT vs. auth token).
- "User" without a role (`buyer`, `controller`, `admin`).
- "Mint" — nothing is minted on chain in this branch; use "issue" or "fulfill" if you mean the post-payment Ticket lifecycle change.

## Relationships

- Event (1) → Tickets (N)
- Event (1) → Categories (N) → Tickets (N)
- Ticket (1) → Holder (1) — transferable only via resale, never directly.
- Holder (1) → Custodial Wallet (1) — ensured by `ensureCustodialWallet`.
- Event (1) → Gates (N) — opened by controllers, navigated to by buyers.
- Holder (1) → Account Balance (1) — at most one MAD balance when demo credit exists.
- Account Balance (1) → Balance Ledger Entries (N) — balances are derived from immutable movements.

## Lifecycle (Ticket Status)

`available` → `reserved` → `sold` → `used`
                              ↘ `listed` → `sold` (via resale)
                              ↘ `refund_pending` → `refunded`
                              ↘ `canceled` / `expired`

## Flagged Ambiguities

- **"Transfer"**: in this branch, only `marketplaceTransfer()` exists, and it returns synthetic signatures — the actual ownership change is the DB update in `fulfillResale()`. Direct wallet-to-wallet transfer is not implemented.
- **"On-chain"**: nothing in this branch is on-chain. Anywhere the code references attribute writes or memo signatures, treat it as a DB-only operation.
- **"Sold" vs. Account Balance**: `sold` is a Ticket status, not a money balance. Use **Account Balance** for internal demo credit.
- **"Account Balance" vs. Custodial Wallet**: Account Balance is app credit only; Custodial Wallet holds synthetic ticket ownership metadata and is not a spendable money account.
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
