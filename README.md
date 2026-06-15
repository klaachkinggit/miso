# Miso

Organization-first ticketing platform. Each organization gets a branded storefront
(`/s/{slug}`, optional subdomain or custom domain), sells tickets by card, runs an
anti-scalping resale marketplace, and scans at the door. Tickets are ERC-721 NFTs
on Base Sepolia (Thirdweb); payments run on Stripe Connect.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase — Postgres (RLS), Auth, migrations; pgvector for AI retrieval
- Stripe Connect — marketplace **separate charges and transfers** (primary + resale)
- Thirdweb — ERC-721 ticket minting/transfers on Base Sepolia
- Vercel AI SDK v6 — Anthropic (copilot + buyer assistant), OpenAI (embeddings)
- Resend (transactional email), Upstash Redis (rate limiting), Sentry (monitoring)
- Vitest (unit) + Playwright (e2e)

See `docs/CONTEXT.md` for the domain glossary (authoritative) and `docs/adr/` for
key decisions.

## Agent harness

The repo-local agent harness supports switching between Codex and Claude without
changing project behavior. Some information is intentionally duplicated across
provider entrypoints so each tool can boot with the same project contract:

- `AGENTS.md` — Codex/project shared rules
- `CLAUDE.md` — Claude Code mirror of the same rules
- `AGENT.md` — compatibility pointer to `AGENTS.md`
- `prompts/` — shared reusable workflow prompts
- `.codex/config.toml` — MCP server configuration
- `.codex/hooks.json` + `.codex/hooks/` — local safety/format hooks
- `.codex/skills/` — Codex skill mirror with compact entrypoints
- `.claude/settings.json` + `.claude/hooks/` — Claude Code safety/format hooks
- `.claude/commands/` — Claude slash-command wrappers for `prompts/`
- `.claude/skills/` — Claude skill mirror matching `.codex/skills/`

`.codex/skills/` and `.claude/skills/` should stay mirrored. Legacy `.agents/`
folders and in-repo harness archive folders are not kept here; use git history
for removed harness files and user-level installs for personal tool preferences.

## Local setup

```bash
npm install --legacy-peer-deps
cp .env.example .env.local          # fill in the values below
supabase start
supabase db reset                   # applies the migration chain (+ seed if present)
npm run supabase:types              # regenerate types (also re-appends convenience aliases)
npm run demo:seed                   # optional demo data
npm run dev                         # http://localhost:3002
```

Next.js reads `.env.local` (gitignored). The `dev` script binds port **3002**.

## Required Environment

Copy `.env.example` to `.env.local` and fill the full template. The app is env-gated: optional
integrations (AI, email, Redis, Sentry, Vercel domains) **no-op cleanly when their
keys are absent**, so a minimal local setup only needs Supabase + Stripe.

```bash
# Core
NEXT_PUBLIC_APP_URL=http://localhost:3002
APP_URL=http://localhost:3002                  # server-side origin fallback
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=                      # server-only — never expose to the client

# Payments (Stripe Connect)
STRIPE_SECRET_KEY=                              # restricted key (rk_ prefix)
STRIPE_WEBHOOK_SECRET=
STRIPE_MARKETPLACE_WEBHOOK_SECRET=              # SEPARATE whsec_ for /api/stripe-marketplace/webhook
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Chain (Thirdweb / Base Sepolia)
THIRDWEB_SECRET_KEY=
THIRDWEB_API_URL=https://api.thirdweb.com
THIRDWEB_BACKEND_SMART_WALLET_ADDRESS=
CHAIN_ID=84532

# AI (optional — copilot + buyer assistant; no key ⇒ feature returns 503 / no-op)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=                                 # embeddings (text-embedding-3-small)
# MISO_AI_MODEL=claude-sonnet-4-6               # optional chat model override

# Optional integrations (all no-op without keys; see .env.example for the full list)
RESEND_API_KEY=                                 # + EMAIL_FROM, EMAIL_REPLY_TO
UPSTASH_REDIS_REST_URL=                         # + UPSTASH_REDIS_REST_TOKEN (rate limiting)
SENTRY_DSN=                                     # + NEXT_PUBLIC_SENTRY_DSN, SENTRY_* build vars
MISO_GATE_ROTATION_SECRET=                      # rotating gate QR, optional locally
```

For local Stripe webhooks:
`stripe listen --forward-to localhost:3002/api/stripe-marketplace/webhook`.

Never commit `.env.local` or provider secrets.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:unit        # vitest
npm run test:e2e         # playwright (run `npm run test:e2e:install` once)
# or everything: npm run test:all
```

## Deploy

Vercel-ready: `development` → preview, `main` → production (production is cut from
`development`; never push `main` directly). Configure production from
`.env.example` plus `docs/ci-and-deploy.md`. Storefront subdomains need a
wildcard domain; custom domains are provisioned via the Vercel Domains API.
