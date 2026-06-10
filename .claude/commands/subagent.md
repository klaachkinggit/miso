---
description: Decide whether to delegate to a subagent (Explore / Plan / general-purpose) — and how to brief it
allowed-tools: Read
argument-hint: <task you're considering delegating>
---

Decide whether to delegate to a subagent for: $ARGUMENTS

## Use a subagent for
- Broad code search spanning >3 files or unknown locations → `Explore`.
- Independent parallel work — two queries with no dependency.
- Bounded research with a written deliverable (`< 200 words`) so raw output never enters parent context.
- Risky reads of large files where only a summary is needed.

## Do NOT use a subagent for
- Tasks where you already know the target file/symbol — read it directly.
- Writing/refactoring on shared files — keep in parent so the diff stays coherent.
- Long dependent chains — each spawn pays cold-start cost.
- "Just in case it parallelizes" — name the independence or skip it.

## Brief
- Goal in one paragraph (what + why).
- What you ruled out — saves rework.
- Deliverable shape (`bulleted list`, `< 200 words`, `file:line citations`).
- Never delegate *understanding* — synthesize yourself.

## After
Subagent reports intent, not outcome. Wrote code → read the diff. Claimed a file exists → grep it.

## Model tier routing (Claude Code `Agent` tool: `model: haiku|sonnet|opus`)

| Tier | Use for | Don't use for |
|------|---------|---------------|
| **Haiku** | File search, "where is X", string-replace refactors, summarizing long output, log triage | Architecture, hard debugging, anything `/risk-review` flags MED+ |
| **Sonnet** *(default)* | Standard coding, test writing, refactor, code review of small diffs, normal `/grill-me` | Tiny lookups (overkill), deep architecture |
| **Opus** | Architecture decisions, risky changes (≥2 HIGH on `/risk-review`), `/adr` drafting, hard debugging | Anything Haiku could do |

Rules:
- Default Sonnet. Drop to Haiku only when task is bounded + shape-clear.
- Promote to Opus when `/risk-review` ≥2 HIGH, Sonnet stalled twice, or `/adr`-worthy.
- One Opus call > five Sonnet retries. Don't ladder cheap.
- Parallel spawns: tier each independently in one turn.
