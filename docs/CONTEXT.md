# Miso Domain Context

Miso is an organization-first ticketing platform where organizers create
their own billeterie, while Miso's current on-chain ticketing system
powers each organization behind the scenes. Tickets are issued as ERC-721
tokens on Base Sepolia through Thirdweb while in-app payments go through
Stripe Checkout Sessions directly.

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
| Organization | Organizer-owned billeterie container with its own public subdomain, branding, events, sales channels, marketplace, legal profile, and payout setup. Miso's own billeterie is also an Organization. |
| Organization subdomain | Public buyer-facing hostname assigned to an Organization, such as `boilerroom.miso.com`. Event pages and the Organization marketplace live under this hostname. |
| Event slug | Human-readable event URL segment unique within one Organization. Public event pages live at `{organization}.miso.com/events/{eventSlug}`. |
| Organizer workspace | Admin app for creating and managing Organizations, events, sales channels, attendees, and payouts. In production it lives on `app.miso.com`. |
| Active Organization | Organization currently selected in the Organizer workspace. It is stored in a server-validated cookie and used to scope event lists, analytics, and event creation. |
| Organization admin | Organization member with full control over legal, billing, payouts, team, events, settings, transfer, and deletion. |
| Organization controller | Organization member who can operate assigned gates for assigned events and cannot buy, list, or checkout through that Organization. |
| Organization membership | Relationship between a Platform account and an Organization. A Platform account may be a member of multiple Organizations. |
| Organization-first platform | Product model where buyers primarily visit a specific Organization's billeterie, not a global Miso marketplace. |
| Organization marketplace | Resale exchange scoped to one Organization's tickets and events. |
| Legacy global discovery | Transitional global event and marketplace surface kept only during migration. It is not the MVP buyer path for the organization-first platform. |
| Organization Stripe account | Stripe Connect account attached to an Organization, not to an individual Platform account. Paid sales are blocked until this account can accept charges. |
| Sales channel | Source route for a purchase or listing checkout, such as mini-site, QR, marketplace, widget, ticket office, invitation, or import. |
| Mini-site | Organization-hosted buyer surface for event discovery and primary ticket checkout. |
| Platform account | One Miso login shared across all Organizations. It is the buyer's global identity and ticket wallet. |
| Organization customer | A Platform account's relationship with one Organization, created through purchase, attendance, or explicit opt-in. Organizations cannot see customer activity from other Organizations. |
| Account-backed checkout | Checkout model where every completed purchase is attached to a Platform account. Guest checkout may be added later only if it creates or claims a Platform account. |
| Event | Admin-created sale surface with categories, inventory, controllers, and one deployed MisoTicket contract. |
| Ticket | One festival entry. The database row is the app source of truth; the ERC-721 token is the public on-chain representation. |
| Digital ticket | Buyer-facing name for a Ticket. NFT details are hidden unless the buyer uses advanced proof or wallet export features. |
| Holder | Profile that owns the Ticket in the app, tracked by `owner_user_id` and `owner_evm_address`. |
| Category | Event ticket tier with EUR price and seeded inventory. |
| Gate | Controller session used to validate and redeem tickets at the venue. |
| Redemption | Gate action that writes a `ticket_redemptions` row, marks the Ticket `used`, and writes the on-chain redeemed attribute. |
| Purchase settlement | Stripe Checkout Session created on ticket reserve; webhook fires on payment success to mint the NFT. |
| Resale settlement | Listing claimed, Stripe Checkout Session created; webhook fires to run `adminTransfer` and close the listing. |
| Face value | Organizer-set ticket price before Miso service fees and Stripe processing fees. |
| Buyer-paid fee | Fee model where the buyer pays the Face value plus Miso service fees and Stripe processing fees, so the organizer receives near the Face value. |
| Resale royalty | Optional organizer-controlled fee on resale listings. When enabled, the buyer pays the royalty on top of the seller's listing price, and the seller still receives the listing price. |

## Payment Model

Payments use Stripe Checkout Sessions (`mode: 'payment'`). The `purchases` and
`resale_listings` tables store `provider_session_id` (Stripe session id),
`payment_provider = 'stripe'`. Fulfillment (NFT mint or transfer) runs in the
`/api/stripe/webhook` handler on `checkout.session.completed`. Session expiry
releases the ticket reservation or listing claim.

Miso uses a Buyer-paid fee model: organizers set the Face value, while buyers
pay the Face value plus Miso service fees and Stripe processing fees.

Organization marketplaces may add an optional Resale royalty. When enabled,
buyers pay the seller's listing price plus the royalty, Miso service fees, and
Stripe processing fees.

## Ticket Lifecycle

`available` -> `reserved` -> `sold` -> `used`

`sold` -> `listed` -> `sold`

`sold` -> `refund_pending` -> `refunded`

`available` -> `canceled`

## Rules

- Controllers can operate gates but cannot buy tickets, list tickets, or use marketplace checkout.
- Checkout retries must be idempotent and must not duplicate mints, transfers, or Stripe sessions.
- Backend wallet authority is issuer-controlled: compromise of that wallet means compromise of all event contracts it administers.
- User smart accounts hold NFTs, but users do not sign on-chain transactions in the current product model.
- Stripe refunds are issued via the API when fulfillment fails after a confirmed payment.

## Terms To Avoid

- "Token" without qualifier. Use "NFT", "auth token", or "token id".
- "NFT ticket" in normal buyer-facing UI. Use Digital ticket unless the user is in an advanced proof or wallet export flow.
- "Solana", "PDA", "mpl-core", "Umi", or "custodial keypair".
- "Shop" for the organizer container. Use Organization unless referring to generic external products like Shopify.
- Legacy wallet terms — payments go through Stripe, not an internal ledger.
