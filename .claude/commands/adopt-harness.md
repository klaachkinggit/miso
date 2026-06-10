---
description: Adopt this harness into an existing project and clean up redundant/stale/improvable skills
allowed-tools: Read, Glob, Grep, Bash, Edit, Write
argument-hint: (run from the project root)
---

Bring this existing project under the harness and clean up its local setup. Project: $ARGUMENTS

1. **Inventory** before touching anything — list existing `.claude/skills/`, `.claude/commands/`, `.claude/hooks/`, `.codex/`, `.cursor/`, rules files (CLAUDE.md, AGENTS.md, .cursorrules, …), `.mcp.json`, `git config --get core.hooksPath`, and `.github/` CI.
2. **Apply the harness** — run apply.sh for the tool(s) in use (backs up overwrites to `.bak`).
3. **Audit each pre-existing skill/command** → classify:
   - **KEEP** — project-specific, useful, no harness equivalent
   - **REDUNDANT** — duplicates a harness skill/prompt/hook → remove
   - **STALE/UNUSED** — unreferenced/outdated/low-quality → remove
   - **IMPROVABLE** — good idea, weak execution → rewrite tighter (sharp description, validators/hard-stops, less prose)
4. **Propose the keep/remove/merge/improve plan to me BEFORE changing anything.** Removing is destructive — wait for explicit confirmation. **Archive to `.harness-archive/`, never hard-delete.**
5. **On approval** — execute. Fold project-specific rules into the bottom of the harness rules file (below the project-rules marker). Never drop project rules.
6. **Verify** — `core.hooksPath` = `.githooks`; skill count under ~10; sanity check.

Harness rules apply: confirm destructive actions, archive don't delete, migrate (don't discard) project rules.
