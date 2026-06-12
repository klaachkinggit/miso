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
