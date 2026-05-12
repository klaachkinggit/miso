# Miso — Roadmap

This document tracks where the product is headed and what remains to do. It
intentionally does not list completed implementation work.

## 1. Product Direction

Miso is an NFT ticketing product for live events. The target entry model is:

- a ticket is a real Solana NFT owned by the buyer;
- the NFT stays in the buyer's wallet during and after entry;
- the gate flow proves ownership instead of transferring or burning the NFT;
- entry consumes the ticket by marking it used in both backend state and
  on-chain redemption state;
- used tickets remain visible as collectibles but no longer grant entry;
- resale is only allowed before use and only through the official Miso
  marketplace.

The current technical direction remains **Path B: pragmatic mpl-core** for the
first production-minded version:

- customer signs a Solana Memo transaction proving ownership;
- backend verifies the transaction, signer, ticket, event, gate, and nonce;
- treasury writes `used=true` to the mpl-core asset Attributes plugin;
- backend dedupes via `redeem_tx_signature` and synthetic `redemption_pda`;
- Phase 2 replaces this synthetic PDA path with a real Anchor program.

## 2. Product Rules To Preserve

- No QR code on the customer ticket.
- Gate QR/short code is only a navigation link to the redemption page.
- The gate QR/code must never be enough to enter by itself.
- Entry requires proof that the customer owns the NFT.
- Never mark a ticket `used` before the ownership proof is verified.
- Failed or timed-out proof leaves the ticket valid and retryable.
- Used, refunded, canceled, expired, and refund-pending tickets cannot enter.
- Direct wallet-to-wallet ticket transfers must fail.
- Official marketplace resale must reject used or invalid tickets.

## 3. Next Milestones

### MVP Hardening

- Add an explicit production/demo mode banner or admin indicator so testers know
  whether they are seeing synthetic demo assets or real Solana NFTs.
- Make LAN/mobile testing smoother by letting the controller QR prefer a
  configured public app URL when present, while still supporting request-origin
  fallback.
- Add clearer controller-side errors for failed gate opening, expired sessions,
  and buyer proof failures.
- Add a small admin/debug view for gate sessions and recent redemption attempts.
- Add focused tests for role permissions:
  - buyer can purchase and use marketplace;
  - controller cannot purchase or access marketplace;
  - admin can access admin and controller workflows.

### Real NFT Redemption Readiness

- Run a full non-demo devnet test with real mpl-core ticket NFTs.
- Verify Phantom/Solflare external-wallet signing end to end on desktop and
  phone.
- Confirm the Memo transaction contains the exact expected payload:
  `{type, ticket, event, gate, nonce, asset, version}`.
- Verify backend rejection paths:
  - wrong wallet;
  - wrong event;
  - reused ticket;
  - missing/changed memo;
  - stale gate;
  - already redeemed on-chain.
- Confirm the treasury attribute write is idempotent and recoverable.
- Add reconciliation coverage for chain-succeeded/backend-failed redemption.

### Marketplace Production Work

- Implement real PayZone resale checkout instead of mock-only resale settlement.
- Add a recoverable resale state machine for payment succeeded but NFT transfer
  failed.
- Add marketplace fee/commission configuration if the business model requires
  it.
- Add seller/buyer transaction history for resale.
- Verify resale rejects tickets whose on-chain attributes already show used.
- Add admin tools for stuck resale transfers.

### PayZone Validation

- Validate request fields against the real merchant kit.
- Confirm hosted checkout redirect URLs for desktop and mobile.
- Confirm webhook signature verification with real PayZone headers.
- Test success, failure, cancel, expiry, refund success, and refund failure.
- Add retry/idempotency tests for duplicate webhooks.
- Document sandbox and production environment variable requirements.

### Operational Readiness

- Decide deployment target and URL strategy before production testing.
- Move secrets to the deployment platform's secret manager.
- Add scheduled jobs for:
  - stale reservation release;
  - past-event ticket expiration;
  - stale gate-session expiration;
  - redemption reconciliation.
- Add structured logging around checkout, gate sessions, redemption, refunds,
  and resale transfer.
- Add basic monitoring/alerts for failed mints, failed redemptions, failed
  PayZone webhooks, and failed marketplace transfers.

## 4. Phase 2: Anchor Redemption Program

The long-term on-chain model should replace the synthetic PDA and treasury
attribute write with a dedicated Anchor program.

Target behavior:

- deterministic redemption PDA per ticket/event;
- on-chain verification that the signer owns the ticket NFT;
- on-chain single-use redemption enforcement;
- backend uses the program state as the source of truth for redemption;
- reconciliation becomes simpler because redemption state is program-owned.

Open design questions:

- whether the program should support multiple event organizers or one platform
  authority;
- how to represent event collections and gate sessions on-chain;
- whether entry should write only redemption state or also update NFT metadata;
- how to handle refunds/cancellations after redemption state exists;
- how to migrate Path B tickets/redemptions into the Anchor model.

## 5. QA Plan

Before calling MVP v1 stable, test these flows manually and with automated
coverage where practical:

- buyer purchase in mock mode;
- buyer purchase in real PayZone sandbox mode;
- buyer ticket appears in My Tickets;
- controller opens gate and displays QR plus fallback code;
- buyer scans QR on phone and redeems;
- buyer enters manual gate code at `/redeem`;
- buyer proof succeeds once and fails on second use;
- wrong buyer cannot redeem someone else's ticket;
- controller sees valid/denied status update without refreshing;
- admin can manage events, controllers, refunds, and gate workflows;
- controller cannot purchase tickets or use marketplace;
- marketplace listing, canceling, and mock purchase;
- resale disabled/expired/used/refunded ticket rejection.

## 6. Current Limitations To Resolve

- Demo mode uses synthetic NFT asset ids and synthetic signatures.
- Real NFT ownership proof still needs full devnet and wallet-device validation.
- Real PayZone checkout and webhook fields need merchant-kit validation.
- Resale with PayZone is not production-ready until the recoverable transfer
  state machine is implemented.
- Phone testing depends on LAN-reachable URLs during local development.
- Phase 2 Anchor redemption is not yet designed or implemented.
