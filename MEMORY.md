## 2026-06-11 - PR #9 merged

- PR #9 (`feat/fable-5-upgrades`) was merged into `development` at `95f5104`.
- Treat old PR #9 upgrade memory as stale. Link: `docs/handoffs/2026-06-11-fable5-session2.md`.

## 2026-06-11 - Stripe WIP ownership

- User now owns the parallel Stripe marketplace WIP; old "do not touch" warning is void.
- Continue from `feat/stripe-marketplace`; fix foundations first if needed. Link: `docs/handoffs/2026-06-11-fable5-session2.md`.

## 2026-06-12 - Stripe marketplace backbone complete, PR #10 open

- PR #10 (`feat/stripe-marketplace-completion` → `development`): full marketplace backbone; 331 tests green. Migration renames mean other machines must `supabase db reset` after pulling.
- Foundation verdict (docs/audits/2026-06-12-foundation-check.md): holds; open blockers before real payments: B2 seller-account registry split (legacy Stripe Connect profiles unlinked to `stripe_seller_accounts`), B3 two live checkout stacks (re-point buy buttons to /api/stripe-marketplace/\* then decommission legacy).
- Competitive gap analysis: docs/research/2026-06-12-competitive-analysis.md (top-10 feature candidates ranked; waitlist, followers, promo codes lead).

## 2026-06-12 - Checkout unification phase 0, PR #11 (stacked on #10)

- Resale buy flow now uses marketplace rails (/checkout/card); B2 legacy-seller backfill migration `20260612221500` landed. Legacy /api/marketplace/checkout route kept until e2e specs are migrated (decommission step).
- OPEN PRODUCT DECISION: primary BuyButton stays on legacy — plan pins marketplace v1 to one-item-per-checkout but storefront sells quantity 1-10 / gifts / club extras. Either extend marketplace to multi-item payments (ADR-worthy: schema junction + partial-fulfillment semantics) or simplify primary flow. Do not re-point buy-button before this is decided.

## 2026-06-13 - Multi-item checkout merged (PR #12); final session prepped

- development @ f62ba3e: backbone complete incl. multi-item primary (ADR 0002); 336 tests green; build env-independent.
- THE PLAN for the final build session: docs/SAAS_V1_PLAN.md (P0 ship blockers -> P1 competitive -> P2 stretch, acceptance checklist included). Handoff: docs/handoffs/2026-06-13-fable5-session3.md.
- First task next session: plan P0.1 legacy checkout decommission (verify free-ticket flow first).

## 2026-06-15 - P1 complete incl. P1.6 AI (PR #25); design skills vendored

- All of P1 shipped to `development`. P1.6 AI in-product merged (PR #25, commit e366c76): env-gated copilot (`/admin`) + org-scoped RAG buyer assistant (`/s/[slug]`) + escalate-to-email.
- AI stack facts: Vercel AI SDK v6 (`streamText().toTextStreamResponse()`, `embed`/`embedMany`, `createAnthropic`/`createOpenAI`). Anthropic has NO embeddings API → OpenAI `text-embedding-3-small` (1536-dim) for pgvector. `org_embeddings` + `match_org_embeddings()` bake org isolation into the RPC (`match_org_id` required); `is_organization_admin` RLS. No keys ⇒ chat 503 / embeddings null / retrieval [] (local+CI stay green). Migration `20260614160000_ai_embeddings.sql`.
- Vendored design skills into `.codex/skills/`: `ui-ux-pro-max`, `impeccable`, `awesome-design-md`. `tay` + `skill-ui` not found on GitHub (skill-ui closest: plugin87/ux-ui-agent-skills).
- Landing "Operator Editorial" glow-up merged in PR #26 (alternate ink/paper spreads, broadsheet ticker, dashboard "plate", giant pricing numbers).

## 2026-06-15 - Current development tip

- PR #26 landing glow-up, PR #27 rotating gate QR, and PR #28 harness update are merged on `development`. Current quality bar from local audit: typecheck/lint/build green; unit tests 425 passed / 4 skipped.

## 2026-06-15 - Harness cleanup target (superseded)

- Superseded by the harness parity correction below. Previous cleanup target was Codex-only; current policy keeps Codex and Claude provider mirrors.

## 2026-06-15 - Harness parity correction

- Supersedes the Codex-only cleanup target: this repo intentionally keeps Codex and Claude provider mirrors so the user can switch tools in-place. Keep `AGENTS.md` and `CLAUDE.md` in sync; keep `.codex/skills/` and `.claude/skills/` mirrored; keep `.agents/` and in-repo harness archive folders out of the tree.
