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
| **Purchase settlement** | The post-payment decision that turns a pending purchase outcome into Purchase and Ticket lifecycle changes. Mock payment reports outcomes; settlement owns database state changes. |
| **Mock payment** | The concrete demo checkout in `src/lib/payments/mock.ts`. It creates synthetic provider ids and reports an inline paid outcome, so the buyer is redirected straight to the success page after Purchase settlement. |
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

## Lifecycle (Ticket Status)

`available` → `reserved` → `sold` → `used`
                              ↘ `listed` → `sold` (via resale)
                              ↘ `refund_pending` → `refunded`
                              ↘ `canceled` / `expired`

## Flagged Ambiguities

- **"Transfer"**: in this branch, only `marketplaceTransfer()` exists, and it returns synthetic signatures — the actual ownership change is the DB update in `fulfillResale()`. Direct wallet-to-wallet transfer is not implemented.
- **"On-chain"**: nothing in this branch is on-chain. Anywhere the code references attribute writes or memo signatures, treat it as a DB-only operation.
