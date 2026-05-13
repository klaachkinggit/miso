# Miso — On-Chain Implementation

This branch (`on-chain-implementation`) pivots Miso from a synthetic
demo build to a real on-chain ticketing app on **Base Sepolia** via
**Thirdweb**.

The detailed phased plan is in [`ON_CHAIN_PLAN.md`](./ON_CHAIN_PLAN.md).
Read that file for the authoritative architecture decisions, contract
source, env vars, and per-phase delivery scope.

## TL;DR

- Real ERC-721 mints on Base Sepolia (chain `84532`), one
  `MisoTicket` contract per event.
- User wallets pregenerated via Thirdweb In-App Wallet keyed on email.
- **Issuer-controlled trust model**: backend wallet
  `0x1860Ef4CdB6EFf2E06C9D3cC4b6530eb2822bAC5` holds
  `MINTER_ROLE`, `METADATA_ROLE`, and `ADMIN_TRANSFER_ROLE` on every
  contract. Users never sign on chain in v1.
- Gas paid by backend wallet (Sepolia ETH free; mainnet later
  amortized via MAD ticket-price markup).
- MAD-only Account Balance ledger remains the in-app payment rail.
  No stablecoin / on-chain payment in this iteration.
- Demo data wiped and re-seeded clean.

## Setup

1. Copy `.env.example` → `.env.local`, fill Thirdweb + Supabase vars.
2. `supabase start && supabase migration up`
3. `npm run demo:seed`
4. `npm run dev` (http://localhost:3002)
5. Sign in as `buyer@miso.local`, purchase ticket → real mint on
   Sepolia. Verify on https://sepolia.basescan.org/.

## Required env vars

```
THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=
THIRDWEB_API_URL=https://api.thirdweb.com
THIRDWEB_BACKEND_WALLET_ADDRESS=0x1860Ef4CdB6EFf2E06C9D3cC4b6530eb2822bAC5
CHAIN_ID=84532
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## QA sanity checklist (final state)

- Admin publishes event → real `MisoTicket` contract deployed; address
  visible in admin UI + basescan.
- Buyer purchases ticket → real ERC-721 mint to buyer smart account;
  `mint_tx_hash` visible on ticket.
- Buyer redeems at gate → on-chain `Redeemed=true` attribute set;
  `redeem_tx_hash` recorded.
- Second redeem attempt rejected.
- Resale purchase → on-chain `adminTransfer` from seller to buyer
  smart account; tx hash recorded.
- Mock payment / balance settlement still works (MAD-only ledger).
- Controller cannot mint, redeem someone else's ticket, or transfer.
- Live Sepolia smoke test passes when `LIVE_CHAIN=true`.

## Out of scope this iteration

- Mainnet (Base 8453)
- Paymaster / Account Abstraction sponsorship
- Session-key-based user signing
- Stablecoin (USDC) payment rail
- Real-money charge / cashout (External Funding Rail still 501)
