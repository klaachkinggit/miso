# CI & Production Deploy — Runbook (P0.4)

Click-side runbook for shipping Miso to production. Infra that needs a human in a
dashboard (Vercel, Supabase, Stripe, GitHub settings) lives here. Code-side config
(`.github/workflows/ci.yml`, `vercel.json`, `supabase/config.toml`) is in the repo.

Repo: `klaachkinggit/miso` · Integration branch: `development` · Production cut: `main`.
App runs locally on **:3002** (not :3000).

---

## 1. CI pipeline

Defined in `.github/workflows/ci.yml`. Two parallel jobs.

**Triggers:** every `pull_request`, and every `push` to `main` or `development`.
Concurrency cancels in-progress runs on the same ref.

### Job: `quality` (ubuntu, Node 20, npm cache)

1. Checkout.
2. **Secret scan** — greps committed `src/` for `password|secret|token|api_key|apikey|aws_secret`
   assigned a quoted 8+ char literal. Excludes `node_modules`, `.next`, `.git`, `tests`,
   `scripts`, `supabase`, and `*.test.*`/`*.spec.*` (those carry known demo fixtures).
   Fails the build on a match.
3. `npm install --legacy-peer-deps`
4. `npm run lint`
5. `npm run typecheck`
6. `npx vitest run`
7. `npm run build`

### Job: `migrations` (ubuntu)

1. Checkout.
2. `supabase/setup-cli@v1` (latest).
3. `supabase db start` — spins up the local Postgres stack in Docker.
4. `supabase db reset` — applies the full **forward-only** migration chain from `supabase/`.
   Fails the build if any migration is broken.

Both job names (`quality`, `migrations`) are the required status checks below — keep
them stable or branch protection breaks.

---

## 2. Branch protection

Already configured on both `development` and `main` via the GitHub API. Both branches
require **`quality`** and **`migrations`** to pass before merge. `enforce_admins` is
**false** — admins may merge after local verification (this is intentional for a
solo/small-team cadence). Force-pushes and deletions are disabled.

Re-apply / audit with `gh` (run once per branch — substitute `development` then `main`):

```bash
gh api -X PUT repos/klaachkinggit/miso/branches/development/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["quality", "migrations"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

```bash
gh api -X PUT repos/klaachkinggit/miso/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": ["quality", "migrations"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

Verify:

```bash
gh api repos/klaachkinggit/miso/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, admins: .enforce_admins.enabled, force: .allow_force_pushes.enabled, del: .allow_deletions.enabled}'
```

> `main` is the **deployment branch only** — never open PRs against it, never push
> directly. It moves only when production is cut from `development`.

---

## 3. Vercel project

| Setting             | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| Production branch   | `main`                                                |
| Preview deployments | `development` (and all other branches/PRs)            |
| Install command     | `npm install --legacy-peer-deps` (from `vercel.json`) |
| Framework           | Next.js 15 (App Router) — autodetected                |

### Domains (host-based storefront routing)

Org storefronts are served by **host**, not path: a request to
`acme.miso.example` is rewritten internally to `/s/acme` (see
`src/lib/organizations/hosts.ts`). To make that work in production:

- [ ] Add the **apex domain** (e.g. `miso.example`) — serves the platform app.
- [ ] Add a **wildcard subdomain** `*.miso.example` — serves every org storefront.
- [ ] Set `MISO_STOREFRONT_ROOT_DOMAINS` to the production apex (comma-separated; this
      replaces the built-in `miso.com`/`shop.miso.com` defaults). Subdomains of these
      roots resolve to org slugs.
- [ ] Set `MISO_STOREFRONT_CANONICAL_ROOT_DOMAIN` to the apex used when building
      canonical storefront URLs (`organizationStorefrontOrigin`).
- [ ] Reserved subdomains (`admin`, `api`, `app`, `www`, `shop`, …) never resolve to a
      storefront — see `RESERVED_STOREFRONT_SUBDOMAINS`. Do not assign them to orgs.

`*.miso.example` is a placeholder — substitute the real production apex everywhere.

### Cron jobs (from `vercel.json`)

| Path                         | Schedule                      | What it does                                                                                                              |
| ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/api/cron/settlement`       | `0 2 * * *` (daily 02:00 UTC) | Re-drives marketplace payments whose settlement lease expired (`reDriveStuckPayments`).                                   |
| `/api/cron/stripe-reconcile` | `0 3 * * *` (daily 03:00 UTC) | Replays recent Stripe events through the idempotent webhook handler to catch missed deliveries (`reconcileStripeEvents`). |

`/api/cron/settlement` is daily because the current Vercel Hobby plan rejects cron
expressions that run more than once per day. When the project moves to Vercel Pro,
restore it to `*/10 * * * *` (every 10 minutes) so stuck marketplace settlements are
re-driven quickly.

Both routes **fail closed** without `CRON_SECRET`: with no secret set they return 503
(unreachable rather than world-callable); with it set they require
`Authorization: Bearer $CRON_SECRET`, which Vercel Cron sends automatically. See
`src/lib/cron/auth.ts`.

- [ ] Set `CRON_SECRET` in Vercel (Production) **before** the first prod deploy, or the
      crons will 503.

---

## 4. Environment matrix

Source: `.env.example`. Every secret/service-role value below must be a **server-only**
Vercel env var — never `NEXT_PUBLIC_*`. Only `NEXT_PUBLIC_*` vars are bundled into the
client. Set vars per-environment (Production vs Preview) so Preview can point at a
staging Supabase/Stripe if desired.

| Variable                                | Where it lives in production      | Notes                                                                                                                                                                |
| --------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | Vercel (Prod + Preview)           | Supabase dashboard → Project → API → Project URL. Public.                                                                                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | Vercel (Prod + Preview)           | Supabase dashboard → API → anon/public key. Public.                                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`             | Vercel (Prod + Preview)           | Supabase dashboard → API → service*role key. **Server-only, bypasses RLS.** Never `NEXT_PUBLIC*\*`.                                                                  |
| `SUPABASE_DB_URL`                       | Vercel (Prod + Preview)           | Supabase dashboard → Database → Connection string (pooler). **Server-only.**                                                                                         |
| `THIRDWEB_CLIENT_ID`                    | Vercel (Prod + Preview)           | Thirdweb dashboard → team → API key (client id).                                                                                                                     |
| `THIRDWEB_SECRET_KEY`                   | Vercel (Prod + Preview)           | Thirdweb dashboard. **Server-only** — sent in `x-secret-key` header. Never commit/expose.                                                                            |
| `THIRDWEB_API_URL`                      | Vercel (Prod + Preview)           | `https://api.thirdweb.com`. Public, but set server-side for consistency.                                                                                             |
| `THIRDWEB_BACKEND_WALLET_ADDRESS`       | Vercel (Prod + Preview)           | The platform backend wallet that mints/transfers tickets. Not secret, but environment-specific.                                                                      |
| `CHAIN_ID`                              | Vercel (Prod + Preview)           | `84532` Base Sepolia (current). `8453` Base mainnet (future). Server-side.                                                                                           |
| `NEXT_PUBLIC_CHAIN_ID`                  | Vercel (Prod + Preview)           | Client-visible mirror of chain id. Public.                                                                                                                           |
| `NEXT_PUBLIC_EXPLORER_BASE`             | Vercel (Prod + Preview)           | Block explorer base, e.g. `https://sepolia.basescan.org`. Public.                                                                                                    |
| `STRIPE_SECRET_KEY`                     | Vercel (Prod + Preview)           | Stripe dashboard → API keys → secret key (`sk_...`). **Server-only.** Use live key in Prod, test key in Preview.                                                     |
| `STRIPE_WEBHOOK_SECRET`                 | Vercel (Preview/dev fallback)     | Legacy/dev fallback signing secret used only when `STRIPE_MARKETPLACE_WEBHOOK_SECRET` is unset. Do not register a production core webhook endpoint. **Server-only.** |
| `STRIPE_MARKETPLACE_WEBHOOK_SECRET`     | Vercel (Prod + Preview)           | **SEPARATE `whsec_...`** for the marketplace endpoint — see callout below. **Server-only.** Falls back to `STRIPE_WEBHOOK_SECRET` only in single-endpoint dev.       |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`    | Vercel (Prod + Preview)           | Stripe dashboard → API keys → publishable key (`pk_...`). Public.                                                                                                    |
| `MISO_PRIMARY_PLATFORM_FEE_PERCENT`     | Vercel (Prod + Preview)           | Business config (default `4`). Not secret.                                                                                                                           |
| `MISO_PRIMARY_PLATFORM_FEE_FIXED`       | Vercel (Prod + Preview)           | Business config (default `0`). Not secret.                                                                                                                           |
| `MISO_STRIPE_FEE_PERCENT`               | Vercel (Prod + Preview)           | Business config (default `1.5`). Not secret.                                                                                                                         |
| `MISO_STRIPE_FEE_FIXED`                 | Vercel (Prod + Preview)           | Business config (default `0.25`). Not secret.                                                                                                                        |
| `MISO_MARKETPLACE_FEE_BPS`              | Vercel (Prod + Preview)           | Marketplace fee in basis points (`500` = 5%). Validated 0–10000. Not secret.                                                                                         |
| `LIVE_CHAIN`                            | Vercel (Preview only, optional)   | `true` enables the live Sepolia smoke test. Leave unset/`false` in Production.                                                                                       |
| `NEXT_PUBLIC_APP_URL`                   | Vercel (Prod + Preview)           | Public canonical app origin. Public.                                                                                                                                 |
| `APP_URL`                               | Vercel (Prod + Preview)           | Server-side canonical origin used for absolute URL construction; wins over header host for non-local requests (`src/lib/url.ts`).                                    |
| `CRON_SECRET`                           | Vercel (Production)               | **Generated secret** (e.g. `openssl rand -hex 32`). Authorizes Vercel Cron. **Server-only.** Without it the cron routes return 503.                                  |
| `MISO_STOREFRONT_ROOT_DOMAINS`          | Vercel (Prod + Preview)           | Comma-separated production storefront root domain(s). Overrides built-in defaults. Not secret. (See §3.)                                                             |
| `MISO_STOREFRONT_CANONICAL_ROOT_DOMAIN` | Vercel (Prod + Preview)           | Apex used for canonical storefront URLs. Not secret. (See §3.)                                                                                                       |
| `TRUSTED_FORWARDED_HOSTS`               | Vercel (Prod, optional)           | Comma-separated allowlist of hosts trusted in `x-forwarded-host` (anti-spoofing). Set only if behind an extra proxy.                                                 |
| `SENTRY_DSN`                            | Vercel (Prod + Preview)           | Server + edge DSN. Optional; unset no-ops. **Server-only.**                                                                                                          |
| `NEXT_PUBLIC_SENTRY_DSN`                | Vercel (Prod + Preview)           | Browser DSN. Public.                                                                                                                                                 |
| `SENTRY_AUTH_TOKEN`                     | Vercel (Prod + Preview)           | Source-map upload token. Build-time only. **Server-only.**                                                                                                           |
| `SENTRY_ORG`                            | Vercel (Prod + Preview)           | Sentry org slug for source-map upload.                                                                                                                               |
| `SENTRY_PROJECT`                        | Vercel (Prod + Preview)           | Sentry project slug for source-map upload.                                                                                                                           |
| `RESEND_API_KEY`                        | Vercel (Prod + Preview)           | Resend API key. Unset disables email sends. **Server-only.**                                                                                                         |
| `EMAIL_FROM`                            | Vercel (Prod + Preview)           | Verified sender, e.g. `Miso <tickets@miso.example>`.                                                                                                                 |
| `EMAIL_REPLY_TO`                        | Vercel (Prod + Preview, optional) | Reply-To address for transactional mail.                                                                                                                             |
| `UPSTASH_REDIS_REST_URL`                | Vercel (Prod + Preview, optional) | Upstash REST URL for rate limiting; unset means no-op.                                                                                                               |
| `UPSTASH_REDIS_REST_TOKEN`              | Vercel (Prod + Preview, optional) | Upstash REST token for rate limiting. **Server-only.**                                                                                                               |
| `VERCEL_PROJECT_ID`                     | Vercel (Prod + Preview, optional) | Enables custom-domain provisioning through the Vercel Domains API.                                                                                                   |
| `VERCEL_API_TOKEN`                      | Vercel (Prod + Preview, optional) | Vercel API token for custom-domain provisioning. **Server-only.**                                                                                                    |
| `ANTHROPIC_API_KEY`                     | Vercel (Prod + Preview, optional) | AI chat model key; unset makes chat routes return 503. **Server-only.**                                                                                              |
| `OPENAI_API_KEY`                        | Vercel (Prod + Preview, optional) | Embedding key for pgvector RAG; unset makes embeddings/retrieval no-op. **Server-only.**                                                                             |
| `MISO_AI_MODEL`                         | Vercel (Prod + Preview, optional) | Optional chat model override.                                                                                                                                        |
| `MISO_GATE_ROTATION_SECRET`             | Vercel (Prod + Preview, optional) | HMAC secret for rotating gate QR links. Unset leaves rotation off. **Server-only.**                                                                                  |
| `MISO_GATE_ROTATION_PERIOD_SECONDS`     | Vercel (Prod + Preview, optional) | Rotation bucket length; default is 60 seconds.                                                                                                                       |

**Observability vars** (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, `SENTRY_PROJECT`) and email vars (`RESEND_API_KEY`, `EMAIL_FROM`,
`EMAIL_REPLY_TO`) are present in `.env.example`. The integrations are env-gated:
unset values no-op locally/CI, while production should set them deliberately.

### Critical callouts

- **`STRIPE_MARKETPLACE_WEBHOOK_SECRET` is its own endpoint.** In the Stripe dashboard
  register a webhook endpoint pointing at **`/api/stripe-marketplace/webhook`** on the
  production domain, subscribed to **exactly** these events:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.closed`
  - `account.updated`

  Copy that endpoint's signing secret into `STRIPE_MARKETPLACE_WEBHOOK_SECRET`. It is a
  **different `whsec_...`** from `STRIPE_WEBHOOK_SECRET`. These seven events are the same
  set the daily reconcile sweep replays (`settlement-sweep.ts`).

- **Do NOT register `/api/stripe/webhook`.** The legacy core webhook route was removed in
  P0.1 and no longer exists in the repo. Only the marketplace endpoint above is live.

- **`CRON_SECRET` is a generated secret**, not a dashboard value. Generate, store in a
  password manager, set in Vercel Production.

- **Service-role / secret keys** (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_*_WEBHOOK_SECRET`, `THIRDWEB_SECRET_KEY`, `CRON_SECRET`, `SUPABASE_DB_URL`,
  `SENTRY_AUTH_TOKEN`) must be **server-only** Vercel env vars. Never prefix them
  `NEXT_PUBLIC_`.

---

## 5. Supabase production

Local `supabase/config.toml` is dev-only (ports, `site_url=localhost`). Production is the
hosted project; configure auth `site_url` / redirect URLs to the production domain in the
Supabase dashboard.

Migrations are **forward-only** — never edit a shipped migration; add a new one.

- [ ] Link the local repo to the prod project:
      `supabase link --project-ref <prod-ref>`
- [ ] Apply the migration chain to prod: `supabase db push`
      (CI already validates the chain via `supabase db reset` on every PR).
- [ ] In the dashboard, enable **PITR (point-in-time recovery)** backups on the prod
      project (paid tier). Confirm retention window meets recovery needs.
- [ ] Set prod auth `site_url` + `additional_redirect_urls` to the production domain(s).
- [ ] Run a **prod types-generation check** after migrating to confirm schema parity:
      `npm run supabase:types` (or `supabase gen types typescript --project-id <prod-ref>`)
      and diff against `src/` types — fail if drifted.

---

## 6. Observability

> Env var names below match what the observability work is adding; they are referenced,
> not assumed-present. Confirm against the final `.env.example` before wiring Vercel.

### Sentry

- [ ] `NEXT_PUBLIC_SENTRY_DSN` — client DSN (public, browser bundle).
- [ ] `SENTRY_DSN` — server DSN (server-only).
- [ ] `SENTRY_AUTH_TOKEN` — **server-only**; used at build time to upload source maps.
- [ ] `SENTRY_ORG`, `SENTRY_PROJECT` — org/project slugs for source-map upload.
- [ ] Verify source maps upload during the Vercel build and that a deliberate test error
      appears in the Sentry project.

### Vercel Analytics

- [ ] Enable Vercel Analytics on the project (dashboard toggle). No secret required.

### Uptime checks

- [ ] Monitor `https://<apex>/` (200) — app liveness.
- [ ] Monitor the `/api/stripe-marketplace/webhook` route. A bare `GET`/`POST` without a
      valid Stripe signature returns a 4xx — that is healthy (endpoint reachable, signature
      enforced). Alert on **5xx** or connection failure, not on the signature rejection.

---

## Ship checklist (first production cut)

1. [ ] Branch protection re-verified on `development` and `main` (§2).
2. [ ] Vercel project: prod branch `main`, install command `--legacy-peer-deps`,
       apex + wildcard domains added (§3).
3. [ ] All env vars set per `.env.example` and the matrix, secrets server-only, `CRON_SECRET` set (§4).
4. [ ] Marketplace Stripe webhook registered at `/api/stripe-marketplace/webhook` with the
       seven events; secret copied in. Legacy `/api/stripe/webhook` NOT registered (§4).
5. [ ] Supabase prod linked, `db push` applied, PITR on, types check clean (§5).
6. [ ] Sentry + Vercel Analytics + uptime checks live (§6).
7. [ ] Cut production: merge `development` → `main` (PR or fast-forward per release
       process). Never push `main` directly; never force-push `main`.
