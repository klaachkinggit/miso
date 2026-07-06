# Miso Agent Guide

This is the first file an AI coding agent should read in this repo.

## Start Here

1. Read `README.md` for setup, stack, and deploy basics.
2. Read `docs/CONTEXT.md` before changing product, auth, checkout, resale, payments, gates, AI, or organization behavior.
3. Read `docs/BRAND.md` before changing UI, landing pages, or buyer-facing copy.
4. Read `docs/AGENT_WORKFLOW.md` for the ownership map, generated-file rules, recovery plan, and finish gate.
5. Run `npm run agent:preflight` before editing. If you are already mid-task with intentional uncommitted changes, run `npm run agent:check-repo` instead.

If a `.codegraph/` directory exists, use CodeGraph before grep/find or broad file reads when locating application code. If it does not exist, skip CodeGraph.

## Edit Ownership

- App routes and route handlers live in `src/app`.
- Shared domain behavior lives in `src/lib`.
- Reusable UI components live in `src/components`.
- Database schema changes live in `supabase/migrations`.
- Supabase generated types live in `src/types/db.ts`; regenerate them with `npm run supabase:types` after local migration changes.
- Runtime configuration examples live in `.env.example`; never edit or commit `.env`.

Edit source owners, not generated output. Do not edit `.next/`, `node_modules/`, `.vercel/`, `.codegraph/`, `.agents/`, `.codex/`, `.claude/`, or local environment files.

## Verification

Use the narrowest check that proves your change, then run the broader gate before handing off:

```bash
npm run agent:check-repo
npm run agent:verify
```

For database migrations, also run the relevant Supabase reset/type-generation flow when available:

```bash
supabase db reset
npm run supabase:types
```

## Finish Gate

Before calling work complete, run:

```bash
npm run agent:finish
```

The finish gate runs verification and fails if the Git worktree is dirty. If the tree is intentionally dirty because the user has not asked for a commit, say that explicitly and include `git status --short`.
