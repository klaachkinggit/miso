## 2026-06-11 - PR #9 merged
- PR #9 (`feat/fable-5-upgrades`) was merged into `development` at `95f5104`.
- Treat old PR #9 upgrade memory as stale. Link: `docs/handoffs/2026-06-11-fable5-session2.md`.

## 2026-06-11 - Stripe WIP ownership
- User now owns the parallel Stripe marketplace WIP; old "do not touch" warning is void.
- Continue from `feat/stripe-marketplace`; fix foundations first if needed. Link: `docs/handoffs/2026-06-11-fable5-session2.md`.

## 2026-06-12 - Stripe marketplace backbone complete, PR #10 open
- PR #10 (`feat/stripe-marketplace-completion` → `development`): full marketplace backbone; 331 tests green. Migration renames mean other machines must `supabase db reset` after pulling.
- Foundation verdict (docs/audits/2026-06-12-foundation-check.md): holds; open blockers before real payments: B2 seller-account registry split (legacy Stripe Connect profiles unlinked to `stripe_seller_accounts`), B3 two live checkout stacks (re-point buy buttons to /api/stripe-marketplace/* then decommission legacy).
- Competitive gap analysis: docs/research/2026-06-12-competitive-analysis.md (top-10 feature candidates ranked; waitlist, followers, promo codes lead).

## 2026-06-12 - Checkout unification phase 0, PR #11 (stacked on #10)
- Resale buy flow now uses marketplace rails (/checkout/card); B2 legacy-seller backfill migration `20260612221500` landed. Legacy /api/marketplace/checkout route kept until e2e specs are migrated (decommission step).
- OPEN PRODUCT DECISION: primary BuyButton stays on legacy — plan pins marketplace v1 to one-item-per-checkout but storefront sells quantity 1-10 / gifts / club extras. Either extend marketplace to multi-item payments (ADR-worthy: schema junction + partial-fulfillment semantics) or simplify primary flow. Do not re-point buy-button before this is decided.

## 2026-06-13 - Multi-item checkout merged (PR #12); final session prepped
- development @ f62ba3e: backbone complete incl. multi-item primary (ADR 0002); 336 tests green; build env-independent.
- THE PLAN for the final build session: docs/SAAS_V1_PLAN.md (P0 ship blockers -> P1 competitive -> P2 stretch, acceptance checklist included). Handoff: docs/handoffs/2026-06-13-fable5-session3.md.
- First task next session: plan P0.1 legacy checkout decommission (verify free-ticket flow first).
