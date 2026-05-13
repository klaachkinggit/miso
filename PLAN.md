# Miso — Demo Branch

This branch is a stripped-down build of Miso for live demonstration. It
removes everything not exercised by the demo seed and demo flow:

- No PayZone payment provider (mock provider only, settles inline).
- No real Solana NFT mint (synthetic asset ids, `demo_asset_<ticket_id>`).
- No on-chain memo / attribute / freeze plugin writes during redemption
  or resale (synthetic signatures, `demo_redeem_*`, `demo_attr_*`, etc.).
- No reconciliation, expiration cron, or devnet airdrop scripts.
- No NFT clawback during refunds.

For the full product roadmap — real mpl-core mint, PayZone integration,
Anchor redemption program, recoverable resale state machine — see the
`main` branch.

## Demo Flow

1. `cp .env.example .env.local` and fill Supabase + WALLET_ENCRYPTION_KEY.
2. `supabase start && supabase migration up`
3. `npm run demo:seed`
4. `npm run dev` (the local dev server runs on http://localhost:3002)
5. Sign in as `buyer@miso.local`, purchase a ticket, scan the controller
   gate QR, redeem.

## QA Sanity Checklist

- Buyer purchase via mock payment settles inline.
- My Tickets shows the new ticket.
- Controller opens a gate; QR + short code both navigate to the redeem page.
- Buyer redeems; second attempt is rejected as `already_used`.
- Wrong buyer cannot redeem someone else's ticket.
- Marketplace listing, cancel, and mock resale purchase all work.
- Resale rejects used / refunded / canceled tickets.
- Controllers cannot purchase or use marketplace.
