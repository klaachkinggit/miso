# Foundation Check — 2026-06-12

Branch: `feat/stripe-marketplace-completion`

## Executive Verdict

**Foundations hold for continued feature development, with three hard blockers that must be resolved before the first real paid transaction goes through the new stack.**

The core architecture is sound: Next.js 15 App Router is used correctly, TypeScript strict mode is clean, RLS is enabled and locked on all sensitive tables, the Stripe separate-charges-and-transfers pattern is correctly wired, and the on-chain layer is well-isolated. No dimension is a structural write-off.

The blockers are all in the payment critical path:

1. **Two Stripe webhook endpoints share one signing secret** — whichever endpoint gets the wrong `whsec_` in production silently drops all its events. Missed fulfillments or missed payment-failure releases on real transactions.
2. **`stripe_seller_accounts` is user-scoped while payout authority belongs to organizations** — legacy-onboarded organizers cannot complete a marketplace payment today (`assertPayoutReady` throws `SellerNotPayoutReadyError` for them). Revenue-integrity risk once both onboarding paths are live simultaneously.
3. **Two live checkout stacks with separate webhook handlers** — `buy-button.tsx` still calls the legacy `/api/checkout`; `buy-listing-button.tsx` still calls `/api/marketplace/checkout`. Any new checkout feature must be implemented twice, and a Stripe event misroute silently skips settlement.

The `events.organization_id` nullable gap and the missing admin chain-ops repair tool are real architectural debts but do not block building features now — both have cheap, additive fixes and no current data is corrupted or inaccessible through the existing legacy paths.

---

## Dimension Verdicts

| # | Dimension | Verdict | Confirmed Blockers |
|---|---|---|---|
| 1 | Domain model & service boundaries | acceptable | 0 (royalty split FIXED in b0f3c9c) |
| 2 | Feature surface — load-bearing vs drag | acceptable | 1 (two live checkout stacks) |
| 3 | Stack & build foundations | acceptable | 0 (react@19/@types@18 downgraded to risk) |
| 4 | Data model & migrations | acceptable | 1 (stripe_seller_accounts user-scoped) |
| 5 | Auth model & RLS | acceptable | 0 |
| 6 | Payments architecture | acceptable | 1 (single webhook secret for two endpoints) |
| 7 | On-chain layer | acceptable | 0 (repair tool downgraded to risk) |

---

## Confirmed Blocking Issues

### B1 — Single `STRIPE_WEBHOOK_SECRET` for two independently registered endpoints
**Dimension:** Payments architecture  
**Confidence:** High

**Evidence:**
- `src/app/api/stripe/webhook/route.ts:11` reads `process.env.STRIPE_WEBHOOK_SECRET`
- `src/lib/stripe-marketplace/client.ts:11` declares `STRIPE_WEBHOOK_SECRET` in `StripeEnv`; `src/lib/stripe-marketplace/webhook.ts:47` passes it to `constructEvent`
- Both `/api/stripe/webhook` and `/api/stripe-marketplace/webhook` are active routes receiving disjoint Stripe event types
- `.env.example:36` declares only one `STRIPE_WEBHOOK_SECRET`; no `STRIPE_MARKETPLACE_WEBHOOK_SECRET` exists anywhere in the codebase

In Stripe, every registered endpoint gets its own `whsec_...` signing secret. Both routes must be separately registered — they receive different event types. With a single shared env var, one endpoint always rejects its deliveries with `400 Signature verification failed`, causing missed fulfillments or missed payment-failure releases with no CI coverage (tests mock the SDK).

**Fix:** Add `STRIPE_MARKETPLACE_WEBHOOK_SECRET` to `.env.example` and update `src/app/api/stripe/webhook/route.ts` to read `STRIPE_LEGACY_WEBHOOK_SECRET` (or, preferred per the plan, retire the legacy endpoint by routing all primary checkout through the marketplace PaymentIntent path).

---

### B2 — `stripe_seller_accounts` is user-scoped; marketplace payment path fails for legacy-onboarded organizers today
**Dimension:** Data model & migrations  
**Confidence:** High

**Evidence:**
- `supabase/migrations/20260611143100_stripe_marketplace_tables.sql:71-72`: `stripe_seller_accounts` keyed by `user_id uuid not null unique references profiles(id)` — no `organization_id`
- Legacy signup flow (`/signup/organizer/stripe` → `ensureConnectAccountForProfile` at `src/lib/payments/stripe-connect.ts:123`) writes to `organizations.stripe_account_id` and `profiles.stripe_account_id`; never inserts a `stripe_seller_accounts` row
- New marketplace onboarding (`src/lib/stripe-marketplace/seller-accounts.ts:177`) writes to `stripe_seller_accounts` by `user_id`; never touches `organizations.stripe_account_id`
- `src/lib/stripe-marketplace/payments.ts:228` calls `assertPayoutReady(organizerUserId)` which queries `stripe_seller_accounts` by `user_id` — returns `no_account` for any legacy-onboarded organizer, throwing `SellerNotPayoutReadyError` and blocking the checkout
- `CONTEXT.md:45` designates Stripe Connect accounts as org-scoped; the current schema directly contradicts this

**Fix:** Add `organization_id uuid references organizations(id)` to `stripe_seller_accounts` with a unique constraint on `(organization_id)`. Write a migration linking existing rows to organizations via `organization_memberships`. Update `assertPayoutReady` to resolve through `organization_id` when present. Deprecate `organizations.stripe_account_id` in favour of `stripe_seller_accounts`.

---

### B3 — Two live checkout stacks with split settlement paths
**Dimension:** Feature surface  
**Confidence:** High

**Evidence:**
- `src/components/site/buy-button.tsx:79` calls `/api/checkout` (legacy Checkout Sessions)
- `src/components/site/buy-listing-button.tsx:24` calls `/api/marketplace/checkout` (legacy resale)
- `src/app/checkout/card/payment-form.tsx:62-63` calls `/api/stripe-marketplace/checkout/primary|resale` (new PaymentIntents)
- Both webhook handlers (`/api/stripe/webhook`, `/api/stripe-marketplace/webhook`) are simultaneously live with disjoint event type subscriptions
- `src/lib/resale/listing.ts:448` still branches on `paymentMode: 'legacy' | 'stripe'`; the old webhook calls `fulfillResale()` without `paymentMode` (defaults to `'legacy'`)

Any new checkout feature (discounts, gifting, multi-ticket) must be implemented in both paths or the divergence deepens. A Stripe event misroute silently skips settlement on one path. Directly coupled to B1 — fixes to the webhook secret situation require knowing which endpoints survive.

**Fix:** Re-point `buy-button.tsx` to `/api/stripe-marketplace/checkout/primary` and `buy-listing-button.tsx` to `/api/stripe-marketplace/checkout/resale` (adapting the response shape). Then decommission `/api/checkout`, `/api/marketplace/checkout`, `/api/stripe/webhook`, and the `paymentMode:'legacy'` branch in `fulfillResale()`.

---

## Notable Risks (Schedule, Not Gate)

### R1 — `events.organization_id` is nullable; smartboard events are invisible to org-scoped queries
**Dimension:** Data model & migrations

`src/app/smartboard/actions.ts:107` calls `createDraftEvent` without `organizationId`; `src/lib/events/setup.ts:90` sets `organization_id: params.organizationId ?? null`. The `events_organization_admin_all` RLS policy (`supabase/migrations/20260605004939:493-497`) is blind to these rows; `loadOrganizationAnalytics` returns empty data for all smartboard-originated events.

The legacy `events_organizer_all` policy is never dropped so self-serve organizer access works today — this is growing debt, not current breakage. Fix before building per-org billing or storefront analytics: backfill `organization_id` from `organizer_user_id` using the MD5-slug pattern already in migration lines 170-175, create Organization rows for smartboard-only organizers, then enforce `NOT NULL`.

### R2 — Reversal idempotency key excludes amount; crash between Stripe success and DB write leaves incorrect `owes_recovery`
**Dimension:** Payments architecture

`src/lib/stripe-marketplace/transfers.ts:198`: `idempotencyKey` is `rev_${marketplaceTransferId}` with no amount component. The routine two-sequential-partial-refunds scenario is safe (the `t.status === 'created'` guard in `planProRateReversals` blocks re-entry after the first reversal is persisted). The real gap is a crash between the Stripe API call succeeding and the local `updateTransferRow` completing — a retry would call `reverseTransfer` again with the same key but a different amount, triggering Stripe idempotency rejection and wrongly flagging `owes_recovery`.

Fix: append `_${amountCents}` to the reversal idempotency key; add a `reversed` status guard in `planProRateReversals` before calling `reverseTransfer`.

### R3 — No admin repair/reconcile tool for `repair_needed` chain_ops rows
**Dimension:** On-chain layer

`src/lib/chain/ops.ts:268-279` marks tickets `repair_needed` when a chain op terminally fails after minting. The existing retry-mint route (`/api/admin/purchases/[id]/retry-mint`) throws immediately when `ticket.status === 'repair_needed'` (`src/lib/tickets/lifecycle.ts:198-201`). No API route, server action, or script reads the `chain_ops` row, calls `ownerOf` on-chain, and writes the corrective DB update. `STRIPE_MARKETPLACE_IMPLEMENTATION_PLAN.md:165` lists this as an open TODO.

Every occurrence requires manual developer SQL against Supabase Studio. This is tolerable now; it becomes unmanaged operational liability as resale and wallet-export volume grows. Fix: add `POST /api/admin/chain-ops/[id]/repair` that calls `ownerOf`, applies corrective DB update, and surfaces a single-click action on the admin event page.

### R4 — react@19 runtime with @types/react@18 type definitions
**Dimension:** Stack & build foundations

`package.json:42` resolves `react` to `19.2.6`; `package.json:58` has `@types/react: ^18.3.12` at `18.3.28`. `vercel.json:2` uses `--legacy-peer-deps` permanently. No React 19-exclusive APIs (`use()`, ref-as-prop) are in production code today; `skipLibCheck: true` suppresses `.d.ts` noise; typecheck passes clean. The mismatch becomes expensive as the team adopts React 19 features. Fix: bump `@types/react` and `@types/react-dom` to `^19.0.0`; remove `--legacy-peer-deps` once the peer tree resolves cleanly.

### R5 — Seven production env vars absent from `.env.example`
**Dimension:** Stack & build foundations

`MISO_STOREFRONT_ROOT_DOMAINS` (`src/lib/organizations/hosts.ts:41`), `MISO_STOREFRONT_CANONICAL_ROOT_DOMAIN` (`hosts.ts:88`), `TRUSTED_FORWARDED_HOSTS` (`src/lib/url.ts:27`), `MISO_RESALE_PLATFORM_FEE_PERCENT` (`src/lib/resale/pricing.ts:4`), `MISO_RESALE_PLATFORM_FEE_FIXED` (`pricing.ts:5`), `MISO_MARKETPLACE_FEE_BPS` (`src/lib/stripe-marketplace/client.ts:17`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`client.ts:12`). A fresh Vercel environment will fail silently on storefront routing and compute incorrect fees.

### R6 — `sold_count` incremented via stale read; concurrent mints can drop counter updates
**Dimension:** On-chain layer

`src/lib/tickets/lifecycle.ts:477` and `:299` use `category.sold_count + 1` (application-level read-then-write) rather than `sold_count = sold_count + 1` (atomic DB increment). Ticket reservation prevents double-dispatch, but the sold-out detection counter and availability display can undercount under concurrent load. Fix: replace with a Postgres-side atomic increment.

---

## Resolved Since Last Audit

**Royalty source-of-truth split (domain-services)** — FIXED in commit `b0f3c9c`. Smartboard event forms now write `events.organizer_resale_royalty_bps` (the marketplace-path knob); `docs/CONTEXT.md` documents both the per-event knob and the legacy org-level `organizations.resale_royalty_bps`. The new checkout path reads the correct column.

---

## What Was Checked and Found Healthy

- **Next.js 15 async-params contract**: uniformly followed across all dynamic pages (`src/app/s/[organizationSlug]/page.tsx:42-43`, `src/app/marketplace/[id]/page.tsx:10`)
- **Server/client boundary**: `server-only` guards on all service modules (`src/lib/supabase/service.ts:2`, `src/lib/events/public.ts:1`, `src/lib/organizations/public.ts:1`, `src/lib/marketplace/public.ts:1`); no layout is a client component
- **TypeScript strict mode**: enabled (`tsconfig.json:7`); no `@ts-ignore` or `as any` in production code; typecheck passes clean
- **Stripe SDK version pinning**: `2026-04-22.dahlia` in both `src/lib/payments/stripe.ts:13` and `src/lib/stripe-marketplace/client.ts:57`; matches installed `stripe@22.1.1`
- **Stripe env validation**: Zod-validated at startup in `src/lib/stripe-marketplace/client.ts:9-38`; missing keys surface on first request
- **RLS coverage**: enabled on all tables; `stripe_seller_accounts`, `marketplace_payments`, `marketplace_transfers`, `chain_ops`, `organizer_profiles` locked to service_role only
- **Middleware session verification**: `auth.getUser()` (JWT verification) not `getSession()` (cookie trust) at `middleware.ts`; active-org cookie cross-checked against actual memberships at `src/lib/organizations/context.ts:65`
- **Webhook signature verification**: both `/api/stripe/webhook/route.ts:22` and `/api/stripe-marketplace/webhook/route.ts:21` verify before processing
- **Stripe marketplace amount split**: three-way check constraint at DB level (`20260611143100:145-149`); partial unique indexes prevent duplicate settlement on retry (`20260611143100:161-174`)
- **Fulfillment-before-transfer ordering**: hard-enforced in `src/lib/stripe-marketplace/fulfillment.ts:202-215`
- **Settlement lease**: atomic compound-predicate UPDATE prevents double-fulfillment and enables crash recovery (`fulfillment.ts:119-122`)
- **Transfer idempotency**: SHA-256(paymentId:role) deterministic keys (`src/lib/stripe-marketplace/transfers.ts:20-26`)
- **Fee arithmetic**: integer-only, bps bounded 0–10000, seller net asserted non-negative (`src/lib/stripe-marketplace/payments.ts:628-631`)
- **MisoTicket.sol**: minimal, role-gated, no user signing surface; `AccessControl` grants all four roles to admin in constructor (`contracts/MisoTicket.sol:21-28`)
- **chain_ops double-mint/double-transfer prevention**: partial unique indexes at DB layer before chain call (migrations `0013`, `20260518113000`)
- **Subdomain routing**: clean middleware rewrite (`middleware.ts:8-12`); RESERVED_STOREFRONT_SUBDOMAINS blocklist (`src/lib/organizations/hosts.ts:7-20`); host-spoofing defense in `src/lib/url.ts`
- **RLS recursion fix**: security-definer helpers (`is_admin()`, `is_organization_admin()`, `organizes_event()`, `controls_event()`) break the chain; documented in migration 0003
- **apply_stripe_account_snapshot**: atomic upsert that preserves `owes_recovery`/`blocked` operator states on late webhook delivery (`supabase/migrations/20260611143200`)
- **Thirdweb integration**: purpose-built HTTP client against Engine API with no SDK bloat (`src/lib/thirdweb/client.ts`); `backendWallet()` deduplicated promise on cold start (`src/lib/thirdweb/transactions.ts:43-78`)
- **Redemption gate**: DB flip is source of truth; chain failure logs to audit but does not block the gate (`src/lib/verification/redeem.ts:302-346`)
- **EUR-only currency migration chain**: clean and auditable across migrations 0016–0018 and `20260518012108`
