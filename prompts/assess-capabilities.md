# Assess Capabilities — acquire the right skills, MCP servers & plugins before building

Use at **project kickoff** (describe the project) or **before any non-trivial
feature** (describe the feature). Goal: pull in the capabilities that genuinely
help — across all three layers — skip everything the base already covers, keep it lean.

## Input

A description of the project, or the feature about to be built.

## Steps

1. **Identify needs** — list the concrete domains/tasks and the **stack** involved
   (e.g. Vercel/Next.js, Docker, Stripe, Supabase, Sentry, AWS, Postgres, Figma).
2. **Check what the base already covers — do NOT re-add these:**
   - Skills/prompts: grill-me, tdd, diagnose, zoom-out, security-scan, preflight, to-issues
   - MCP servers: **github, filesystem, git, playwright, db (Postgres)** are already configured
   - Workflow: Superpowers (plugin)
3. **For genuine gaps, assess all three layers:**
   - **Skill?** Invoke `find-skills` / `npx skills find "<need>"`; check skills.sh + PROFILES.md.
   - **MCP server?** Many stacks have one (Vercel, Docker, Stripe, Supabase, Sentry, Linear, Notion, Figma…). See PROFILES.md "MCP servers by stack", or browse the official registry / awesome-mcp-servers / `/plugin` Discover tab.
   - **Plugin?** A plugin can bundle skills+commands+MCP for a whole stack (e.g. `vercel/vercel-plugin`). Check `/plugin` Discover, claude.com/plugins, and the pre-configured MCP plugins in `claude-plugins-official` (github, vercel, supabase, sentry, linear, notion, figma, …).
4. **Vet before installing** — prefer official/vendor sources, 1K+ installs, repo >100 stars. In Claude Code's `/plugin` Discover tab, check the **Context cost** estimate. Reject paid-API/niche unless clearly needed.
5. **Install only high-value, non-redundant capabilities**, project-scoped. Keep skills well under ~10; remember MCP servers can be token-heavy too.
6. **Report, then build** — state what you added per layer (and why), what you skipped (already covered), then proceed.

## Guardrails

- Prefer ONE plugin that bundles a stack over many loose skills, when available.
- A base-harness prompt beats a new skill when they overlap; an existing MCP beats a new one.
- Never install unvetted. This is an assessment, not a shopping spree — if the base covers it, add nothing.
