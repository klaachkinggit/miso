---
description: Session-end token / spend sanity check + structural fixes if cost is drifting
allowed-tools: Bash, Read
---

Check session cost and diagnose if it's drifting.

1. Run `/cost` (Claude Code) — note session totals.
2. Inspect `.claude/bash.log` size and command count — proxy for tool-call density.
3. List skills: `ls .claude/skills/`. Every skill description loads each session. Prune anything unused ~2 weeks.
4. List MCP servers: `claude mcp list`. Disable per-project servers not in use.
5. Subagent over-use? See `/subagent` for the rules — if you spawned for tasks you could've read directly, that's the bleed.
6. Did the session compact? `CLAUDE.md` says `/compact` before each new work phase.
7. Were subagents tiered? Haiku for cheap lookups, Sonnet default, Opus only for `/risk-review` ≥2 HIGH or `/adr`-worthy work. See `/subagent`.

If a structural change is warranted (skill removed, MCP disabled, workflow change), log a 3-line entry to `MEMORY.md` via `/memorize`. If a usable next-time heuristic emerged, append it to `LESSONS.md` via `/learn`.
