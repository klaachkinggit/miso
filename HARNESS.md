# Harness

This repo carries a Claude/Codex provider mirror plus universal git and CI
guards. Enforcement belongs in git hooks and CI whenever possible; runtime hooks
are a faster local copy for tools that support them.

## Files

| Layer         | Source                                                    |
| ------------- | --------------------------------------------------------- |
| Rules         | RULES.md, synced into AGENTS.md and CLAUDE.md             |
| Prompts       | prompts/\*.md                                             |
| MCP           | tools/gen-mcp.py, .mcp.json, .codex/config.toml           |
| Runtime hooks | .claude/hooks, .codex/hooks, shared bodies in tools/hooks |
| Git/CI guards | .githooks and .github/workflows                           |
| Skills        | mirrored .claude/skills and .codex/skills                 |

Keep AGENTS.md and CLAUDE.md semantically aligned. Keep provider skill and hook
mirrors behavior-equivalent. Do not restore .agents or in-repo harness archives.

## MCP

Base servers: github, filesystem, git, playwright, sequential-thinking, context7,
and db when DATABASE_URL is set. Use CodeGraph first when .codegraph exists.

Generate provider config:

- python3 tools/gen-mcp.py claude
- python3 tools/gen-mcp.py codex

Optional stack MCPs live in tools/apply-profile.sh. Current profiles are vercel,
supabase, stripe, figma, and all. Verify with tools/check-profile.sh.

## Hooks

Provider wrappers in .claude/hooks and .codex/hooks execute shared scripts in
tools/hooks. Verify with tools/check-agent-context.sh --tool all and
tools/preflight-harness.sh.

Shared hooks:

- project-scope.sh: blocks local file access outside the project root.
- protect-secrets.sh: blocks direct secret file reads/writes.
- block-dangerous.sh: blocks destructive shell commands and secret-file moves.
- auto-format.sh: formats edited files when configured.
- log-bash.sh: records shell commands in provider-local logs.
- pre-pr-gate.sh: blocks PR creation when tests fail.

## Adoption

For a new tool:

1. Load RULES.md.
2. Translate .mcp.json or add an emitter to tools/gen-mcp.py.
3. Set git config core.hooksPath .githooks.
4. Use prompts/\*.md directly.

Run tools/preflight-harness.sh after any harness change.
