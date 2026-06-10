# Subagent — When to Delegate

Subagents (Claude Code's `Agent` tool, Codex's task delegation, etc.) protect the main context from exploration noise and parallelize independent work. They are **not free** — each spawn re-derives context cold. Use only when the win is real.

## Use a subagent for
- **Broad code search** spanning >3 files or unknown locations (Claude Code: `Explore` subagent).
- **Independent parallel work** — two queries with no dependency between them. Spawn both, await both.
- **Bounded research** with a written deliverable (`< 200 words`) so the raw output never enters the parent context.
- **Risky reads of large files** you only need a summary of.

## Do NOT use a subagent for
- Tasks where you already know the target file/symbol — read it directly.
- Writing/refactoring code on shared files — keep that in the parent so the diff is coherent.
- Long-running chains of dependent steps — each spawn pays cold-start cost. Run sequentially in-parent.
- "Just in case it parallelizes" — if you can't name what makes the work independent, it isn't.

## How to brief one
- State the goal in one paragraph (what + why).
- List what you already ruled out — saves rework.
- Specify the deliverable shape (`bulleted list`, `< 200 words`, `file:line citations`).
- Never delegate *understanding* — don't write "based on findings, fix the bug." Synthesize yourself.

## Verifying
A subagent reports what it *intended* to do, not necessarily what happened. If it wrote code: read the diff. If it claimed a file exists: grep it. Trust the artifact, not the summary.

## Token budget
Subagent output crosses back into the parent context. Cap the deliverable size in the brief. A 5K-token summary defeats the purpose.

## Model tier routing

Cheaper models for cheaper jobs. Both Claude Code's `Agent` tool (`model: haiku|sonnet|opus`) and Codex's task delegation accept per-spawn model overrides. Use them — Haiku is ~10× cheaper than Opus per token.

| Tier | Use for | Don't use for |
|------|---------|---------------|
| **Haiku** (fast/cheap) | File search, "where is X defined", string-replace refactors, list extraction, summarizing long output, log triage | Architectural choices, hard debugging, anything risk-graded MED+ by `/risk-review` |
| **Sonnet** (default) | Standard coding, test writing, straightforward refactor, code review of small diffs, normal `/grill-me` | Tiny lookups (waste of capability), or genuinely deep architecture work |
| **Opus** (flagship) | Architecture decisions, risky changes (`/risk-review` ≥2 HIGH), `/adr` drafting, hard debugging where Sonnet stalled, multi-file logic with subtle invariants | Anything Haiku could do — pure cost burn |

### Rules of thumb
- Default to Sonnet. Drop to Haiku only when the task is obviously bounded and shape-clear.
- Promote to Opus when: `/risk-review` flags ≥2 HIGH dimensions, Sonnet has tried and failed twice, or you're about to write an ADR.
- One Opus call beats five Sonnet retries. Don't ladder cheap.
- For independent parallel work: route each spawn to its own tier (e.g., Haiku for "find all files matching X" + Sonnet for "draft the test"). Run them in one turn.

### When tier choice doesn't matter
For Codex / Cursor / Windsurf / Gemini and other tools without per-subagent model selection, the tier table is still useful as a *prompt-level* hint: state the tier in the brief ("treat this as a Haiku-tier lookup, no analysis needed") to anchor verbosity and depth.
