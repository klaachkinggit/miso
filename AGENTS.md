# Dev Harness — Behavioral Rules

## Foundational Rules (Karpathy)

1. **No silent assumptions.** Task ambiguous → ask one focused question before proceeding. Never assume scope and run with it.
2. **No over-abstraction.** Simplest code that solves the problem. Three similar lines > premature abstraction. No hypothetical future requirements.
3. **No silent mutations.** Never remove or change code you don't understand without flagging it first.

## Communication

- Terse by default. No pleasantries, hedging, filler. No trailing summaries — diff speaks.
- Reference code as `file:line`. Fragments OK.
- Full sentences only for: security warnings, destructive op confirmations.

## Code

- No comments unless WHY is non-obvious (hidden constraint, workaround, subtle invariant).
- No error handling for impossible scenarios. Trust framework/internal guarantees.
- No features beyond task scope. No half-finished implementations.
- Validate only at system boundaries (user input, external APIs).
- No security vulnerabilities: SQL injection, XSS, command injection, hardcoded secrets.

## Workflow

- Before any non-trivial feature, assess whether a skill, MCP server, or plugin would help (`prompts/assess-capabilities.md` / `find-skills`); vet and install before building. Never add what the base already covers.
- Front-end / UI work → use the design skills in `.claude/skills/`: `frontend-design` (bold, anti-generic UI), `ui-ux-pro-max` (styles, palettes, font pairs, UX rules), `impeccable` (anti-slop self-audit), `web-design-guidelines` (a11y / Web Interface Guidelines review), `awesome-design-md` (drop-in design systems). Commit to one aesthetic direction; audit before shipping.
- Use `prompts/grill-me.md` before any large implementation — uncover all decision branches first.
- Multi-file behavior change → run `prompts/sparc.md` (Spec → Pseudocode → Architecture → Refinement → Completion). Skip for typo/single-line/bump.
- Failing test before implementation on any non-trivial change.
- Use `prompts/security-scan.md` on any auth, data persistence, or infra change.
- Use `prompts/preflight.md` before every PR or deploy.
- Run `prompts/audit.md` weekly or before milestones — reports a punch list, no auto-fixes.

## Memory, Decisions & Learning

- Read `MEMORY.md` and `LESSONS.md` at session start if present.
- Hard-to-reverse choice → write an ADR via `prompts/adr.md` (template at `docs/adr/0000-template.md`).
- Non-obvious decision, constraint, or quirk → append to `MEMORY.md` via `prompts/memorize.md`. Append-only.
- End-of-task: if something non-obvious worked or failed, append a heuristic to `LESSONS.md` via `prompts/learn.md`. Only write the lesson if you can name the "next time" rule.

## Risk & Review

- Before `/preflight` on auth/data/infra changes, run `prompts/risk-review.md`.
- ≥2 HIGH-risk dimensions → write an ADR and route review through Opus tier (see `prompts/subagent.md`).

## Subagents & Cost

- Delegate to a subagent only when independent or broad — see `prompts/subagent.md`. Each spawn pays cold-start; do not delegate work whose target you already know.
- **Model tier routing**: Haiku for search/summaries/bounded lookups, Sonnet default, Opus for `/risk-review` ≥2 HIGH or `/adr`-worthy work. One Opus call beats five Sonnet retries.
- At session end (or weekly): `prompts/cost-review.md` — `/cost`, prune unused skills/MCP, verify `/compact` discipline.

## Token economy

- **Navigate with the code graph, not blind sweeps.** Use the CodeGraph MCP (`codegraph_search` / `codegraph_explore` / `codegraph_status`) to find symbols, callers, and blast radius before reading files — it replaces multi-call grep/read fans (~−47% tokens, −58% tool calls; 100% local). Build/refresh per repo with `codegraph init`; it auto-syncs on edits.
- **Read semantically, not wholesale.** Prefer graph/symbol lookups and scoped reads (offset/limit) over whole-file dumps; for one-shot whole-repo context use `repomix`.
- **Route by cost.** Cheap model (Haiku / mini tier) for search, summaries, bounded lookups; reserve the strong model for design, architecture, and review.
- **Keep the cache warm.** Rules files load every turn and are prompt-cached — keep them stable; don't mutate per-session. Heavy procedures live in skills/prompts (lazy-loaded), not here.
- **Compact deliberately.** `/compact` at a phase boundary (~60–70% context), not at the auto-compaction cliff. Offload heavy reads to subagents so their intermediate output never inflates the main thread.

## Destructive Actions

Full sentences. Explicit confirmation required. Never skip hooks. Never force-push main.

---

<!-- Add project-specific rules below this line -->

## Project: Miso

- Stack: Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (Postgres + RLS) + Thirdweb (Base Sepolia ERC-721 ticketing).
- Dev server: `npm run dev` — runs at http://localhost:3002 (NOT 3000).
- Lint: `npm run lint` · Typecheck: `npm run typecheck` · Build: `npm run build`.
- Domain glossary: `docs/CONTEXT.md` (authoritative — read before non-trivial changes).
- Payments: PayZone is explicitly out of scope; mock provider settles inline.
- Supabase migrations live in `supabase/`; regenerate types with `npm run supabase:types` after schema changes.
- Smart contracts in `contracts/`; compile via `npm run contracts:compile`.

## Branching

- `main` is the **deployment branch only** — never open PRs against it, never push directly. It moves only when production is cut from `development`.
- `development` is the integration branch where features land for local testing and shared QA.
- Open every PR against `development` (or against its predecessor when the work is stacked). Stacked PRs target the previous branch in the chain; the chain's root branch targets `development`.
- When asked to "create a PR" without an explicit base, assume `--base development`.
