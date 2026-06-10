# Cost Review — Token / Spend Sanity Check

Run at session end (or weekly for long-running projects). The harness can't instrument LLM tokens at the hook layer — this prompt is the manual checkpoint.

## What to look at
- **Claude Code:** `/cost` — shows session token totals and dollar estimate.
- **Codex:** check provider dashboard for the day's spend.
- **Repo signals:**
  - `.claude/bash.log` size and command count (proxy for tool-call density).
  - Long-running subagent spawns — each pays cold-start.

## Diagnose if cost feels high
1. **Skill bloat** — `ls .claude/skills/` and `/plugin list`. Every skill description loads each session. Prune anything unused for ~2 weeks (`HARNESS.md` rule).
2. **MCP server count** — `claude mcp list`. Each server's tool list is in-context. Disable per-project servers you're not using.
3. **Subagent over-use** — Did you spawn agents for tasks you could've read directly? See `prompts/subagent.md`.
4. **No `/compact`** — Long sessions without compaction repeatedly re-read history. `CLAUDE.md` says compact before each new work phase.
5. **Subagent tiering** — Were spawns routed to the right model? Haiku for cheap lookups, Sonnet default, Opus only for `prompts/risk-review.md` ≥2 HIGH or ADR-worthy work. See `prompts/subagent.md`.

## Output
A 3-line note in `MEMORY.md` if a structural change is needed (e.g., "skill X removed — cost spike from descriptions"). Otherwise no action.
