# Miso Handoff - 2026-06-11, Session 2

Reader: Claude Fable 5, ultracode effort. User wants the next session to leverage the harness aggressively.

Current branch: `feat/stripe-marketplace`, created from `development` at `95f5104`.

This handoff exists in the repo because the original `/tmp/miso-handoff-fable5.md` would not be available from the user's other machine.

## Current State

- PR #9 was merged into `development` at `95f5104`, and local `development` was fast-forwarded.
- The old `feat/fable-5-upgrades` branch is done.
- User granted ownership of the parallel-session Stripe WIP. Any previous memory saying "do not touch" that WIP is stale.
- User chose: merge PR #9, take over Stripe WIP, build on the current codebase rather than starting from scratch.
- A full gap analysis of the Stripe WIP was completed by an explore subagent in the previous session.
- The next session should not assume the current foundations are good. The first step is an architecture-level foundation check.

## Stripe WIP Gap Analysis

The Stripe WIP is roughly 85% complete and appears directionally good:

- checkout for primary and resale tickets
- webhook dispatcher with signature verification
- separate charges and transfers
- fulfillment-first settlement with lease idempotency
- refunds with pro-rata transfer reversals
- marketplace payment state machine
- organizer self-serve onboarding / smartboard
- unit and e2e specs

Reference docs:

- `docs/STRIPE_MARKETPLACE_IMPLEMENTATION_PLAN.md`
- `docs/adr/0001-stripe-separate-charges-and-transfers.md`

Known broken seams to fix:

1. Duplicate migration prefixes: two files each at `0016`, `0017`, and `0018` (`*_eur_currency`, `*_eur_only_constraints`, `*_drop_account_balances` versus `*_stripe_marketplace_*`). This can break Supabase db push/reset on fresh installs. Determine what is tracked, untracked, and locally applied; then renumber or merge cleanly.
2. `src/types/db.ts` was not regenerated for migrations `0016` through `0019`. Run `npm run supabase:types`, then `npx tsx scripts/db-aliases.ts`.
3. Typecheck had about 10 integration errors:
   - `requireApiProfile` is used by onboarding routes but not exported from `src/lib/api/auth.ts`.
   - `getResaleCheckoutListing` is used but not exported from `src/lib/resale/listing.ts`.
   - `fulfillResale` lacks the `paymentMode` param passed by the WIP.
   - `events/setup.ts` functions lack the `actorUserId` param passed by smartboard actions.
   - `src/lib/stripe-marketplace/client.ts` pins Stripe API version `2025-02-24.acacia`; the installed SDK expects `2026-04-22.dahlia`.
4. `/checkout/success` is broken for card flow. The payment form redirects with `?marketplace_payment_id=...`, but the page only reads `session_id` and `purchase_id`, causing an infinite "Minting ticket" spinner. It should resolve `marketplace_payment_id` to a purchase and show buyer-facing `fulfillment_pending`.
5. No admin UI or route calls `manuallyRefundPayment`; the refund logic exists, but the admin refunds panel is still legacy-only.
6. `organizer_resale_royalty_bps` is not surfaced in smartboard event forms.
7. Env gaps: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing from `.env.example`; `MISO_MARKETPLACE_FEE_BPS` is undocumented.
8. Missing tests: `fulfillment_pending` causes no transfers, risk-blocked publish, payout-readiness publish gate, and MAD checkout rejection at checkout level.

## User Directive

The user's goal is a deploy-ready SaaS that competes with established players.

Keep the project vision:

- org-first event ticketing marketplace
- on-chain ERC-721 tickets on Base Sepolia
- organizer self-serve flows

Everything else is negotiable.

### Step 1 - Foundation Check First

Before building more features, run an architecture-level audit. This is not a normal lint/test check. Review early decisions and foundations:

- stack choices: Next.js 15, Supabase with RLS, Thirdweb/Base Sepolia, TypeScript
- service boundaries
- language and domain model
- data model
- auth model
- existing feature set: what is load-bearing versus drag

While preserving the vision, rework weak foundations if needed so future building is easier. This step is a check, not a must. If the foundations hold, say so and move forward.

Use:

- `/zoom-out`
- `docs/CONTEXT.md`
- `docs/adr/`
- `improve-codebase-architecture` skill

### Step 2 - Competitive Analysis, Then Match Caliber

Analyze the competition and the broader SaaS marketplace bar. Relevant ticketing competitors include Eventbrite, Dice, Shotgun, Tito, Billetweb, Fatsoma, and Lyte/resale-style players.

User explicitly wants exploration of:

- chatbots, such as support or organizer assistants
- customizable ticket marketplace / storefront builder, like Shopify shop customization or Lovable-style builder flows
- other features the market now expects

Use web search because the current date is 2026-06-11.

### Step 3 - Leverage The Harness

The user explicitly wants the next agent to use the harness:

- skills: `stripe-best-practices`, `supabase`, `frontend-design`, `prototype`, `design-an-interface`, `improve-codebase-architecture`, `grill-with-docs`, `tdd`, and relevant command skills
- subagents: choose the right model for the task; use small research agents for search, stronger agents for high-risk architecture
- MCPs: github, playwright, filesystem, git if available
- plugins and new capabilities: search for more when useful via `find-skills`, `/assess-capabilities`, and the `stripe-projects` skill

Follow `CLAUDE.md` harness rules: PRs target `development`, never `main`; use SPARC for multi-file work; write ADRs for hard-to-reverse decisions; run preflight before PRs.

## Suggested Skills

- `improve-codebase-architecture` for the foundation check.
- `zoom-out` for a broader product and architecture pass before coding.
- `stripe-best-practices` and `upgrade-stripe` before finishing marketplace payments.
- `supabase` and `supabase-postgres-best-practices` for migrations, RLS, and generated types.
- `frontend-design`, `prototype`, and `design-an-interface` for storefront customization and SaaS-grade UI.
- `find-skills` and `stripe-projects` to discover additional harness capabilities.

## Suggested Sequence

1. Run the foundation check.
2. Finish the Stripe marketplace backbone.
3. Add competitive-caliber features: storefront customization, chatbot, billing/plans, emails, growth loops.
4. Production hardening and deploy.

Reorder only if the foundation check changes the picture.

## Reference

- Dev server: `npm run dev`, usually `localhost:3002`.
- Lint: `npm run lint`.
- Typecheck: `npm run typecheck`.
- Development had 230 unit tests passing before the Stripe WIP was taken over.
- Test accounts: organizer, buyer, and admin local accounts are documented in prior handoffs and seed/test setup.
- Stripe env: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` were present locally; the publishable key was missing.
- Old branches possibly holding useful work: `stripe-europe-cash-in-out`, `features-v2`, `frontend-premium-redesign`, `landing-ui-ux-redesign`, `on-chain-implementation`.
- Demo/tour `*.png` files in the repo root are screenshot artifacts and should not be committed unless deliberately needed.
