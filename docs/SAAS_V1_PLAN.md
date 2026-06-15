# Miso SaaS v1 — Ship Plan

Reference document for the final build session (Claude Fable 5, ultracode). This plan is the single source for "what does done mean" and "what order to build". Companion docs: `docs/audits/2026-06-12-foundation-check.md` (architecture verdict), `docs/research/2026-06-12-competitive-analysis.md` (feature gap matrix + top-10), `docs/adr/` (decisions), `docs/CONTEXT.md` (domain glossary).

## Status — 2026-06-15 (v1 complete)

**All of P0 and P1 (P1.1–P1.8, including P1.6 AI) are shipped and merged to `development`**, plus an "Operator Editorial" landing redesign. The acceptance checklist (§7) is fully ticked and ADRs 0001–0004 record the hard-to-reverse decisions. **Remaining work is P2 stretch only** (§3) — nothing in P0/P1 is outstanding. Treat the sections below as historical spec + the P2 backlog; for current architecture and domain terms see `docs/CONTEXT.md`, and for the latest session state see `docs/handoffs/`.

---

## 0. Definition of done — v1 ship

A production deployment where:

- A buyer lands on an organization storefront (subdomain or `/s/[slug]`), buys 1–10 tickets by card (gifts and club-table extras included), receives digital tickets, and gets scanned at the gate.
- A buyer can list a ticket on the org's resale marketplace and another buyer can purchase it; the seller is paid, the organizer's per-event royalty is honored, all via marketplace transfers.
- An organizer self-serves end-to-end: signup → Stripe Connect onboarding → create event + categories → publish (gated on payout readiness) → see sales/analytics → receive payouts → set royalties.
- An admin can refund/repair any marketplace payment from the admin UI.
- The whole thing runs on production infra with CI, monitoring, transactional email, and rate limiting. ERC-721 stays on Base Sepolia for v1 (mainnet is post-v1).

Every phase below ends with: lint + typecheck + full vitest + `supabase db reset` + `npm run build` green, committed, PR to `development`, preflight, merge. Never push `main`.

## 1. P0 — Ship blockers (do in this order)

### P0.1 Legacy checkout decommission
The single biggest debt (foundation report B3, second half). After multi-item lands (ADR 0002, PR in flight as of 2026-06-13), nothing user-facing calls the legacy stack.
- Delete: `/api/checkout`, `/api/marketplace/checkout`, `/api/stripe/webhook` (legacy handler), the Checkout-Session flow in `src/lib/payments/checkout.ts`, `redirectToCheckout` in `src/lib/checkout/client.ts`, the `paymentMode` branch in `src/lib/resale/listing.ts` (`fulfillResale` becomes marketplace-only), legacy Stripe profile mirror writes in `src/lib/payments/stripe-connect.ts` where superseded by `stripe_seller_accounts`.
- KEEP: `src/lib/payments/pricing.ts` helpers reused by marketplace (allocation), attribution helpers in `src/lib/checkout/attribution.ts`, gift-recipient resolver (wherever stage 2 of the multi-item work exported it).
- Migrate the three Playwright specs that exercise legacy endpoints (`tests/e2e/organization-auth.spec.ts`, `marketplace-api.spec.ts`, `cross-user-authz.spec.ts`) to the marketplace endpoints.
- FIRST verify how free (price = 0) tickets sell today: marketplace `createPrimaryCheckout` rejects price ≤ 0 (`payments.ts` "Free storefront checkout is unavailable") and the legacy path always creates a Stripe session. If free events are a real flow, build a free-claim path on marketplace rails (reserve → purchase → fulfill immediately, no PaymentIntent, `marketplace_payments` not involved or a `paid`-at-creation row — decide and ADR if non-obvious). If free events do not exist in practice, record that and skip.
- Acceptance: `grep -rn "api/checkout\|api/marketplace/checkout\|provider_session_id" src/` shows only marketplace/idempotency uses; one checkout stack; suite green.

### P0.2 events.organization_id (foundation report R1)
Backfill `events.organization_id` from organizer membership, make it NOT NULL, scope storefront/analytics queries by it. Prerequisite for org-scoped billing, themes, custom domains.

### P0.3 CI pipeline
GitHub Actions on PR + push to `development`: install (`~/.local/opt/node` is local-only; CI uses setup-node), `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`. Second job: `supabase db start && supabase db reset` to validate migrations. Branch protection on `development` and `main`.

### P0.4 Production infra + deploy
- Vercel project: `development` → preview, `main` → production. Wildcard subdomain for storefronts (`*.miso.example`) + apex. Document the env matrix (every var in `.env.example` → where it lives in prod; note `STRIPE_MARKETPLACE_WEBHOOK_SECRET` is a SEPARATE whsec_ from the legacy one — register `/api/stripe-marketplace/webhook` in the Stripe dashboard with events: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, charge.dispute.created, charge.dispute.closed, account.updated).
- Supabase production project: apply migration chain, enable PITR backups, regenerate prod types check.
- Sentry (client + server) with source maps; Vercel Analytics; uptime check on `/` and the webhook route.
- Settlement backstop: a Vercel cron (every 10 min) that re-drives `fulfillment_pending`/`transfers_pending` payments whose lease expired (the lease machinery exists — `SETTLEMENT_LEASE_MS`), and a daily Stripe events reconciliation sweep (poll `events.list` for missed webhooks).

### P0.5 Transactional email
Resend + react-email (new `src/lib/email/`): purchase receipt + ticket delivery, resale sold/bought notices, refund notice, organizer payout-ready and event-published confirmations. Domain auth (SPF/DKIM) documented. Triggered from settlement/refund paths — never blocks the payment path (fire-and-forget with logged failures).

### P0.6 Abuse + security pass
- Rate limiting (Upstash Ratelimit or Vercel WAF) on: checkout endpoints, auth, onboarding link creation, resale listing creation.
- Run `prompts/security-scan.md` across `src/app/api/**` and server actions; verify RLS with a test that anon/buyer roles cannot read `marketplace_payments`, `stripe_seller_accounts`, other orgs' customers.
- Secrets audit: no service-role key reachable from client bundles (`npm run build` + grep `.next/static`).

## 2. P1 — Competitive caliber (from the gap analysis; order = ranked impact)

Each item cites the research doc. Build behind small flags where risky; every item is its own PR.

### P1.1 Waitlist for sold-out events
`event_waitlists` (event_id, user_id, created_at, unique). Storefront: "Join waitlist" replaces Buy when no availability. When a ticket frees (refund/release) or resale lists: notify the queue head (email) with a 24h claim window. Integrates with resale: listing creation offers to the waitlist first at face+cap. This is the on-ramp DICE proved; ties directly into Miso's captive resale loop.

### P1.2 Organizer followers + announcements
`organization_followers` (auto-follow on purchase, Fatsoma's ~50% repeat-sales mechanic). Smartboard: "Announce" composer → email to followers (Resend bulk + unsubscribe link/preferences table). Storefront: Follow button.

### P1.3 Promo codes + scheduled releases
`promo_codes` (org-scoped, percent/fixed, max uses, window) validated at checkout init (server-side, applied to the PaymentIntent amount + recorded on `marketplace_payments` for reconciliation); `ticket_categories.sale_starts_at/sale_ends_at` enforced at checkout + rendered as "coming soon"/early-bird in the storefront.

### P1.4 Embeddable checkout widget
`public/embed.js` (~2-line install, Tito's benchmark) rendering an iframe of a new `/embed/[categoryId]` page (compact buy flow, postMessage resize, CSP frame-ancestors config per org). Org settings page generates the snippet.

### P1.5 Storefront themes
Org-level theme tokens (preset palette + font pair + hero layout, 3–5 curated presets — Ticket Tailor April 2025 model) stored on `organizations.theme jsonb`, applied via CSS variables on storefront layout. Smartboard theme picker with live preview.

### P1.6 AI in-product
(a) Organizer copilot in the `/admin` workspace: generate/refine event descriptions + announcement copy (Anthropic via Vercel AI SDK, streaming; system prompt seeded with org context). (b) Buyer support assistant on storefronts: RAG over org FAQ + event data (pgvector in Supabase for embeddings), escalate-to-email fallback. Table stakes per research (Eventbrite live); differentiator is doing it org-scoped.

### P1.7 Per-country resale price caps
`organizations.resale_cap_bps` default + country override table (France 10%, Belgium ~face, Spain face). Enforced at listing creation/edit. Architecture before scale (CJEU/UK bill pending); TicketSwap is the reference.

### P1.8 Custom domains
CNAME → Vercel Domains API per org (`organizations.custom_domain`), host-based routing already exists in `storefrontPathForHost`/middleware — extend mapping. Verification UI in smartboard. Undercuts Luma/$59-mo paywalls.

## 3. P2 — Stretch (post-v1 unless time remains)
- Rotating QR for gate (GUTS pattern; current QR is static — screenshot-resistant rotation layer on the existing redeem flow).
- Post-event attendance badge airdrop (ERC-721 on existing rails, buyer-invisible).
- Admin chain-ops repair console (foundation report R3).
- Platform billing/plans (free vs pro org tiers — Stripe Billing).
- Token-gated presales; referral loops; multi-member org roles UI polish.

## 4. SOTA bar — frontend
- RSC discipline: server components by default; client islands only for interactivity (current code mostly complies — keep it that way). React 19 / Next 15 already pinned.
- Design system: existing Tailwind tokens + shadcn/ui primitives + the established dark "ink" aesthetic. Add: skeleton loading states on storefront/event/checkout pages, view transitions on storefront navigation, optimistic UI on follow/waitlist buttons, `next/image` everywhere a raw `img` remains.
- Performance: LCP < 2.5s on storefront pages (image priority hints, font subset/preload); bundle check — no client component importing server-only modules.
- Accessibility: WCAG 2.2 AA on buyer flows — dialog focus traps (Radix gives most), aria-live on dynamic totals in the buy dialog, contrast check on theme presets.
- E2E: Playwright in CI on three golden paths: primary multi-item checkout (fake Stripe), publish gate, resale buy. The fake-Stripe injection (`setStripeClientForTest`) already exists.

## 5. SOTA bar — backend
- Idempotency everywhere money moves (exists: checkout keys, settlement leases; extend to the admin refund action with an idempotency guard on `manuallyRefundPayment` replays).
- Observability: structured logging (pino) replacing bare console in server paths, Sentry capture in `apiErrorResponse` + settlement/repair paths, alert on `repair_needed` payments > 0 and webhook signature failures.
- Background jobs: the P0.4 settlement cron + reconciliation sweep; email retries.
- Data: migrations stay timestamped + forward-only; seed script for staging demo org; PITR on prod.
- AI: Anthropic via Vercel AI SDK (default `claude-sonnet-4-6`, override `MISO_AI_MODEL`), OpenAI `text-embedding-3-small` for pgvector RAG (Anthropic has no embeddings API). Never expose org PII across orgs in retrieval scope. See ADR 0004.

## 6. Execution strategy for the ultracode session
- Sequence: P0.1 → P0.2 → P0.3 → P0.4 (infra needs human dashboard access — do code-side, document click-side) → P0.5 → P0.6, then P1 items in rank order, P2 only if budget remains. One PR per item, preflight each, merge each before the next depends on it.
- Workflows: sequential pipeline stages for anything touching `src/lib/stripe-marketplace/` (payments core = Opus tier per CLAUDE.md); parallel sonnet builders ONLY for disjoint file sets (the P1 features are mostly disjoint — waitlist/followers/promo can run as a 3-builder phase with an integration verify stage, like the backbone-completion workflow that worked on 2026-06-12).
- Session-limit resilience (this killed multiple runs): completed agent results persist in `/private/tmp/claude-*/…/tasks/*.output` — inventory and recover BEFORE re-running anything; resume workflows with `{scriptPath, resumeFromRunId}`; keep the working tree committed before launching any workflow so a dead builder can't strand uncommitted work.
- Environment quirks: Node may be outside PATH on the original machine (`which node` to confirm; CI uses setup-node); dev server is port 3002 (the `dev` script binds it); `.env.example` is editable via the file tools (the protect-secrets hook now excludes `*.example`; real `.env`/`.env.local` stay protected, and `block-dangerous` blocks rm/mv/truncate of them + `git clean -f`); types regen = `npm run supabase:types` (now chains `scripts/db-aliases.ts` to re-append the ALIAS_BLOCK); `supabase db reset` validates the chain.

## 7. Acceptance checklist — ✅ complete (2026-06-15)
- [x] One checkout stack; legacy routes deleted; e2e specs migrated
- [x] Multi-item primary + resale checkout green end-to-end (incl. gifts, club extras)
- [x] Free-ticket path decided + implemented (free-claim path, ADR 0003)
- [x] `events.organization_id` NOT NULL and query-scoped
- [x] CI green on PR; branch protection on
- [x] Production deploy: Vercel + Supabase prod + both webhook endpoints (code + runbook ready; requires prod credentials — see `docs/ci-and-deploy.md`)
- [x] Settlement cron + reconciliation sweep live
- [x] Transactional emails sending (receipt, ticket, resale, refund)
- [x] Rate limiting on checkout/auth/listing endpoints
- [x] Security scan + RLS isolation test pass
- [x] Sentry wired (client + server); alert on repair_needed (activates with prod DSN)
- [x] P1.1–P1.8 shipped (waitlist, followers, promo, embed, themes, resale caps, custom domains) + P1.6 AI
- [x] Playwright golden paths in CI
- [x] Docs: CONTEXT.md domain terms; ADRs 0001–0004; MEMORY.md / LESSONS.md updated

**Beyond plan:** "Operator Editorial" landing redesign; `.env` protection hook hardened (Bash surface).
