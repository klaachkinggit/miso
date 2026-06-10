---
description: Five-phase structured build (Spec → Pseudocode → Architecture → Refinement → Completion)
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: <feature description>
---

Build $ARGUMENTS using SPARC. Each phase has a hard gate — do not advance until met.

## S — Specification
Problem, user, acceptance criteria. Out-of-scope list (≥3 items).
**Gate:** can you write the test names from the spec?

## P — Pseudocode
Plain-language algorithm + data shapes. Name 1–3 risky steps + failure/recovery.
**Gate:** every risky step has a written recovery plan.

## A — Architecture
Files/modules, deps in/out, new external surface (API/CLI/config).
Hard-to-reverse choice → write an ADR (`/adr`).
**Gate:** reviewer can name the blast radius from this section.

## R — Refinement (TDD)
RED → GREEN → REFACTOR per `/tdd`. Smallest test that proves the next slice.
**Gate:** no TODO, no commented-out code, no skipped tests in the diff.

## C — Completion
Run `/preflight`. If auth/data/infra changed → `/security-scan`.
Non-obvious decision → `/memorize`.
**Gate:** all preflight items PASS; ADR (if any) is `Accepted`.

Skip SPARC for: typo fixes, single-line bugs, dependency bumps, formatting.
