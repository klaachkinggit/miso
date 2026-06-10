---
description: Assess the skills, MCP servers & plugins a project/feature needs, vet + install, then build
allowed-tools: Read, Glob, Grep, Bash, Skill
argument-hint: <project or feature description>
---

Assess what capabilities are needed for: $ARGUMENTS — across skills, MCP servers, and plugins — then install the useful ones and build.

1. **Identify needs + stack** (e.g. Vercel/Next.js, Docker, Stripe, Supabase, Sentry, AWS, Postgres, Figma).
2. **Don't re-add what the base covers:** skills/prompts (grill-me, tdd, diagnose, zoom-out, security-scan, preflight, handoff, to-issues); MCP (github, filesystem, git, playwright, db); workflow (Superpowers).
3. **Assess gaps across all three layers:**
   - Skill → invoke `find-skills` / `npx skills find "<need>"` (skills.sh, PROFILES.md)
   - MCP → check PROFILES.md "MCP servers by stack", official registry, awesome-mcp-servers, `/plugin` Discover
   - Plugin → `/plugin` Discover, claude.com/plugins, `claude-plugins-official` pre-configured MCP (github/vercel/supabase/sentry/linear/notion/figma/…); a plugin like `vercel/vercel-plugin` can bundle a whole stack
4. **Vet** — official/vendor sources, 1K+ installs, repo >100★; check the `/plugin` Context-cost estimate. Reject paid-API/niche unless needed.
5. **Install** only high-value, non-redundant capabilities, project-scoped. Keep skills under ~10; MCP servers can be token-heavy too.
6. **Report** per layer (added + why, skipped because already covered), then build.

Prefer one stack-bundling plugin over many loose skills. A base prompt beats a new skill; an existing MCP beats a new one. Never install unvetted.
