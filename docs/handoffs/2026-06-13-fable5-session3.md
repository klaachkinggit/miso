# Miso Handoff — 2026-06-13, Session 3 (FINAL BUILD SESSION)

Reader: Claude Fable 5, ultracode. This is the last session: the user expects a fully working, deployment-ready SaaS at the end of it. **The plan is `docs/SAAS_V1_PLAN.md` — follow it in order.** This handoff is only session state + operational knowledge.

## Read first
1. `docs/SAAS_V1_PLAN.md` — the entire work list, prioritized P0 → P1 → P2, with acceptance criteria (§7) and the execution strategy for an ultracode session (§6).
2. `MEMORY.md`, `LESSONS.md` — operational state + hard-won heuristics. Trust them.
3. `docs/audits/2026-06-12-foundation-check.md`, `docs/research/2026-06-12-competitive-analysis.md` — the why behind the plan.
4. `docs/adr/0001-*` (both), `docs/adr/0002-multi-item-primary-marketplace-payments.md`, `docs/CONTEXT.md`.

## State of development (tip: f62ba3e)
- PRs #9, #10, #11, #12 merged. The Stripe separate-charges-and-transfers backbone is COMPLETE including multi-item primary checkout (quantity 1–10, gifts, club-table extras) on marketplace rails. Both buy buttons use `/checkout/card`; legacy routes exist but nothing user-facing calls them.
- Green: lint, typecheck, 336 vitest tests, full `supabase db reset` (39 migrations), `npm run build` exit 0 (no env needed — `/` is force-dynamic).
- Work begins at plan P0.1 (legacy decommission). Its spec in the plan is precise — including the free-ticket verification step that MUST happen before deleting legacy.

## Open items carried into this session
- Legacy checkout decommission (P0.1) — everything is staged for it; three Playwright specs reference legacy endpoints and must be migrated.
- Free (price = 0) tickets: marketplace path rejects them; verify whether free events are a real flow before P0.1 deletes legacy (see plan).
- `sales_channel` for the new primary rail stayed `"mini_site"` (legacy parity). If product wants a distinct channel, it's a one-line change in `src/app/api/stripe-marketplace/checkout/primary/route.ts` + enum.
- B2 note: legacy organizers were backfilled into `stripe_seller_accounts` with risk `clear` (migration `20260612221500`); new accounts default `restricted` until webhook sync.
- Foundation R3 (admin chain-ops repair tool) is plan P2.

## Operational knowledge (cost the previous sessions real time)
- **Node**: `export PATH="$HOME/.local/opt/node/bin:$PATH"` in EVERY Bash call. Dev server port 3002. Supabase CLI via `npx supabase` (Docker must be up).
- **Exit codes through pipes lie**: `npm run build 2>&1 | tail` returns tail's exit code. Always `set -o pipefail` in verification commands. A fake "build PASS" survived a whole session this way.
- **Session limits kill subagents mid-run**: completed agent results persist in `/private/tmp/claude-*/…/tasks/*.output` (JSON, `result` key). Inventory and recover BEFORE re-running. Resume workflows with `{scriptPath, resumeFromRunId}`. Commit the tree before launching any workflow.
- **Verify subagent claims against git**: a verifier once reported a "route rename" that never happened and a "pre-existing build failure" with a wrong cause. `git status` + running the command yourself is cheaper than trusting.
- **Types regen**: `npm run supabase:types && npx tsx scripts/db-aliases.ts` (keep ALIAS_BLOCK in `scripts/db-aliases.ts` current — it is NOT derived automatically).
- **`.env.example` is Read-blocked by a hook** — append via bash heredoc.
- **Migrations**: timestamped, forward-only; validate with `npx supabase db reset`. Machines that applied the renamed WIP migrations need a reset.
- **Parallel builders**: only on disjoint file sets, tell each to ignore others' typecheck errors, and run a verify stage after. Anything touching `src/lib/stripe-marketplace/` core: sequential pipeline, Opus tier.
- **Stripe**: API version pinned `2026-04-22.dahlia` in BOTH clients; never pass `payment_method_types`; marketplace webhook has its own `STRIPE_MARKETPLACE_WEBHOOK_SECRET` (separate registered endpoint, falls back to `STRIPE_WEBHOOK_SECRET` in dev).

## Rules that bind this session
- PRs target `development`, never `main`; `main` moves only when production is cut from `development`.
- One PR per plan item; preflight (with pipefail!) before each; merge before dependents.
- ADR for hard-to-reverse choices; update `docs/CONTEXT.md` for new domain terms; `MEMORY.md`/`LESSONS.md` at the end.
- The vision is fixed: org-first ticketing marketplace, invisible ERC-721 on Base Sepolia, organizer self-serve. Everything else is negotiable only inside the plan's priorities.
