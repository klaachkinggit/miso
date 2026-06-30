# Profiles

Project profiles are deliberately small. The base harness already ships github,
filesystem, git, playwright, sequential-thinking, and context7. Do not add
package install profiles here; app packages belong in package.json only when source code
imports them.

## Optional MCP Profiles

Use these only when the project needs the live external system:

| Profile  | Adds                                                       |
| -------- | ---------------------------------------------------------- |
| vercel   | Hosted Vercel MCP                                          |
| supabase | Hosted Supabase MCP in read-only mode                      |
| stripe   | Local Stripe MCP through npx, forwarding STRIPE_SECRET_KEY |
| figma    | Hosted Figma MCP                                           |

Commands:

- tools/apply-profile.sh vercel
- tools/apply-profile.sh supabase
- tools/apply-profile.sh stripe
- tools/apply-profile.sh figma
- tools/apply-profile.sh all --dry-run
- tools/check-profile.sh
- tools/remove-profile.sh stripe

Both profile tools support --tool claude, codex, or all. They preserve custom MCP
servers already present in the Claude and Codex MCP config files.

Auth notes:

- Vercel and Figma are hosted OAuth MCPs; complete client auth when prompted.
- Supabase defaults to read_only=true; set SUPABASE_PROJECT_REF before applying when one project should be pinned.
- Stripe needs STRIPE_SECRET_KEY in the shell or project env before use.

## Skill Policy

Keep one workflow skill active at a time. The base harness uses portable prompts
and mirrored provider-local skills. Install extra skills only for a project need,
mirror them for Claude and Codex when both tools need them, and remove skills
that go unused for about two weeks.

Superpowers is a workflow option from obra/superpowers, not a base dependency.
Use it project-scoped if installed. Otherwise use the base equivalents:
grill-me, sparc, tdd, diagnose, sequential-thinking, CodeGraph, and harness
preflight.
