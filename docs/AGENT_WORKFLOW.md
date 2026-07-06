# AI Agent Workflow

This document treats Miso as an AI-agent work environment, not only as a codebase. Its job is to reduce rediscovery, stale-context risk, and unfinished handoffs.

## Current Audit

Safe facts from the current checkout:

- The repository is compact: application code, migrations, docs, local Codex skill/config files, and package metadata are tracked.
- No tracked build output, reports, archives, or obvious generated artifact directories were found in the tracked file set.
- Local runtime directories are ignored: `.next/`, `node_modules/`, `.vercel/`, `.codegraph/`, `.agents/`, `.claude/`, and Codex session logs.
- There is no `.codegraph/` index in this checkout right now, so agents should not assume CodeGraph is available.
- `src/types/db.ts` is generated from Supabase and is tracked because application code imports it.
- The old broad harness surface is not present on this branch. Keep the replacement lightweight and repo-local.

Main risks for future AI work:

- Ownership was implicit. An agent could edit a route, shared domain library, migration, generated database type, or env template without knowing the source of truth.
- Verification was under-specified. README listed checks, but there was no one-command preflight, no finish gate, and no encoded dirty-tree rule.
- Architecture navigation depended on memory. The repo has clear domain folders, but no first-read index tying route ownership to domain modules.
- Database type regeneration was easy to forget after migrations.
- There is no test script in `package.json`; future agents must not claim tests passed unless they added or ran a real test command.

## Recovery Plan

1. Add a first-read `AGENTS.md` so agents know the reading order, edit owners, generated-file boundaries, and finish gate.
2. Add executable agent scripts:
   - `npm run agent:check-repo` checks repo shape, generated/local artifact hygiene, ignored local state, deploy exclusions, script wiring, JSON syntax, and shell script executability.
   - `npm run agent:preflight` runs the repo contract and refuses a dirty worktree before editing.
   - `npm run agent:verify` runs formatting whitespace checks, repo contract checks, install health, dependency audit, typecheck, lint, build, and any future test script if one is added.
   - `npm run agent:finish` runs verification and then refuses to pass while the worktree is dirty.
3. Keep docs small and authoritative. Prefer updating `AGENTS.md`, `README.md`, `docs/CONTEXT.md`, or this file over creating dated reports.
4. Keep generated artifacts out of commits unless they are tracked source contracts such as `src/types/db.ts`.
5. For deeper architecture work, propose one module-deepening candidate at a time before refactoring.

## Agent Reading Order

Use this order for a new task:

1. `AGENTS.md`
2. `README.md`
3. `docs/CONTEXT.md`
4. `docs/BRAND.md` when UI/copy/brand is touched
5. The smallest owning source folder for the task
6. Existing migrations or generated types only when data shape is involved

## Ownership Map

| Area | Source of truth | Notes |
| --- | --- | --- |
| Buyer and organizer routes | `src/app` | Next.js App Router. Page guards do not replace authorization in server actions or route handlers. |
| Shared domain behavior | `src/lib` | Prefer domain folders such as `payments`, `stripe-marketplace`, `organizations`, `tickets`, `gates`, and `ai` over adding route-local business logic. |
| Reusable components | `src/components` | Keep shadcn-style primitives in `src/components/ui`; domain components belong in named folders. |
| Database schema | `supabase/migrations` | Add forward migrations. Do not edit old migrations casually unless explicitly repairing local history. |
| Database types | `src/types/db.ts` | Generated with `npm run supabase:types`; do not hand-edit except as an emergency with explanation. |
| Environment contract | `.env.example` | `.env` and `.env.local` are local-only and protected. |
| Deployment config | `vercel.json`, `.vercelignore`, `next.config.ts` | Keep local agent/index/build folders excluded from deploy uploads. |
| Agent workflow | `AGENTS.md`, `docs/AGENT_WORKFLOW.md`, `tools/agent-*.sh` | Update when workflow, ownership, or verification changes. |

## Generated And Local Files

Never edit or commit:

- `.env`, `.env.local`, `.env.*.local`
- `.next/`, `node_modules/`, `out/`, `dist/`, `build/`
- `.vercel/`, `.codegraph/`, `.agents/`, `.claude/`, `.codex/sessions/`
- test reports, coverage, local screenshots, or one-off audit reports unless the user explicitly asks for a tracked artifact

Tracked generated contract:

- `src/types/db.ts` is generated but intentionally tracked. If migrations change, regenerate it and review the diff.

## Verification Guide

Default gate:

```bash
npm run agent:check-repo
npm run agent:verify
```

What it does:

- `git diff --check`
- `npm run agent:check-repo`
- `npm ls --depth=0`
- `npm audit --audit-level=high`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test` or `npm run test:unit` only if the script exists

Database-change add-ons:

```bash
supabase db reset
npm run supabase:types
```

Use these only when the local Supabase CLI and Docker environment are available.

## Finish Gate

Run this before saying the task is complete:

```bash
npm run agent:finish
```

The finish gate refuses dirty worktrees. A task can only be called complete when one of these is true:

- the worktree is clean after a user-approved commit, or
- the agent explicitly reports that the worktree is dirty because commit approval was not requested and includes the exact `git status --short` output.

## Architecture Guidance

Use the codebase-design vocabulary:

- A route should stay thin. Shared behavior belongs in a deeper `src/lib/<domain>` module.
- A seam is useful only when behavior varies. Do not add interfaces for hypothetical adapters.
- The interface is the test surface. If a bug crosses routes, move the invariant to a shared domain function and verify it there.
- Prefer deleting shallow pass-through modules over adding new layers.

High-value deepening candidates for later work:

| Candidate | Problem | Safer next step |
| --- | --- | --- |
| Checkout/payment invariants | Payment, resale, refunds, transfers, and fulfillment span routes, Stripe webhooks, and domain libraries. | Inventory invariants in `src/lib/stripe-marketplace` and add focused tests before changing settlement behavior. |
| Organization auth and active-org scoping | Admin routes, server actions, and route handlers can drift if authorization is only checked at the page level. | Audit server actions and route handlers for direct org-role checks before refactoring. |
| Storefront versus legacy global buyer paths | Organization-first routes and legacy global routes coexist. | Document which routes are active, compatibility-only, or deprecated before deleting or merging routes. |
| Supabase type generation | Schema and generated TypeScript can drift if migrations are edited without regeneration. | Add migration-specific verification when a test runner or DB CI is introduced. |

Do not start these refactors without a focused task. The safest improvement in this pass is to make the workflow explicit and enforceable.
