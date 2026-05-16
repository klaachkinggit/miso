# On-chain risk audit — `on-chain-implementation`

Adversarial review by Codex (2026-05-15) surfaced a recurring pattern: chain
operations are broadcast before a durable "in-flight" record exists, then
local rollback (balance compensation / reservation release) runs on every
failure path, including timeouts. Because Thirdweb timeouts can still mine,
this can leave on-chain state ahead of DB state.

This document lists what was fixed in this pass and what is queued for a
follow-up schema/state-machine change.

## Fixed in this pass

- **settlement.ts — timeout vs revert classification**
  `settlePaidPurchase` now distinguishes a `TransactionTimeoutError`
  (uncertain, may still mine) from terminal failures. On timeout it:
  - leaves the purchase as `pending` (not `failed`)
  - leaves the ticket reservation in place
  - emits `purchase.fulfillment_pending` audit
  - throws `FulfillmentPendingError`
  `/api/checkout` catches that error and returns HTTP 202 with `status:
  "pending"`. The existing admin retry-mint route (`/api/admin/purchases/[id]/retry-mint`)
  can resume.

## Remaining critical findings — schema follow-up needed

These need a new ticket state (`minting` / `transferring`) and a row that
records `{ intended_buyer, transaction_id, idempotency_key }` *before* the
chain call so retries resume the exact same operation. Not done in this pass
because they require a migration + state-machine rework.

1. **lifecycle.ts — mint before DB claim** (Codex critical)
   Mint is submitted, then DB update runs. If DB update fails after a mined
   mint, the token exists with no DB record.
   Fix path: persist a `minting` row with `transaction_id` before
   `writeContract`. On retry, resume that exact tx — never re-mint.

2. **lifecycle.ts — idempotencyKey `mint-${ticket.id}`** (Codex critical)
   After a timeout-then-reservation-release-then-new-buyer scenario, the
   second mint reuses the key and Thirdweb returns the first mint's record,
   so DB records the *second* buyer as owner of the *first* buyer's NFT.
   Fix path: idempotency key bound to `purchase.id`, not `ticket.id`, plus
   the new `minting` state preventing the reservation release.

3. **resale/listing.ts — transfer before atomic listing claim** (Codex critical)
   `fulfillResale` reads `listing.status='active'`, then debits balance, then
   broadcasts `adminTransfer`. Two parallel buyers can both pass the read.
   Fix path: atomic UPDATE moving listing → `transferring` with the buyer's
   id; only one writer wins; chain call only on that winner.

4. **resale/listing.ts — post-mined transfer DB failure** (Codex critical)
   After a mined `adminTransfer`, a failed `transferListedTicketToBuyer`
   triggers compensation. Chain owner moved, DB still points at seller, buyer
   refunded → free transfer.
   Fix path: once tx is mined, do NOT compensate. Mark listing
   `repair_needed`, retry the DB update idempotently.

5. **ledger.ts — debit dedup + compensation** (Codex high)
   `account_balance_debit` deduplicates by `(reference_type, reference_id)`.
   After a compensated purchase, retrying the same `purchase.id` returns the
   *old* debit row without re-debiting, while the compensation credit remains.
   Net: buyer keeps the money AND gets the ticket.
   Fix path: model holds vs reversals explicitly, or use per-attempt
   reference ids.

6. **transactions.ts — role admin on old contracts** (Codex high)
   `backendWallet()` now returns the smart wallet. Contracts deployed before
   that change granted roles to the EOA. Mints/transfers/setAttribute on
   those contracts will fail. Fresh deploys are fine.
   Fix path: per-event "role admin" address column, or a one-shot grantRole
   migration script.

## Tests added in this pass

- `tests/e2e/invariants.spec.ts` — balance overdraft, debit idempotency,
  redemption replay unique index, reservation race, cancellation refund.
- `tests/e2e/cross-user-authz.spec.ts` — cross-user listing cancel,
  self-purchase block, controller role gates.
- `tests/e2e/controller-flow.spec.ts` — controller landing, gate open/poll/
  close, cross-controller authz.

Run with `MISO_E2E_INVARIANTS=1 npx playwright test`. Existing live-chain
smoke remains gated by `LIVE_CHAIN=true` and is unaffected.
