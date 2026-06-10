---
description: Classify the current diff by risk dimension (schema/auth/API/concurrency/blast-radius/reversibility/state/side-effects)
allowed-tools: Bash, Read, Grep, Glob
argument-hint: (optional) <base ref> e.g. main
---

Score the current diff by risk. Base: ${ARGUMENTS:-HEAD}.

1. Diff: `git diff $ARGUMENTS` (or `git diff HEAD` if no arg).
2. For each changed file, score LOW / MED / HIGH on each dimension + one-line reason:
   - **Schema** — DB / API contract field changes
   - **Auth/permissions** — auth middleware, sessions, ACL, role checks
   - **Public API** — exported function/CLI/HTTP signature changes
   - **Concurrency** — async, locks, transactions, retries, idempotency
   - **Blast radius** — caller count, foundational module
   - **Reversibility** — one-way migrations, deleted data, dropped columns
   - **State migration** — backfill / shape coercion needed
   - **External side effects** — network, file write, email, payment, 3rd-party API

Output: top-3 hotspots first, then per-file table.

If ≥2 dimensions land HIGH on any single change → recommend `/adr` and route the review through Opus tier (see `/subagent`).
