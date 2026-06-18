# Miso Feature Inventory

This inventory is derived from the current codebase, not from prior product
notes. Main evidence: `src/app/**` routes, `src/app/api/**` handlers,
`src/lib/**` service modules, `scripts/seed.ts`, and the Supabase migrations.

## What Miso Is

Miso is an organization-first ticketing platform for events, venues, and clubs.
Each organization can run a branded storefront, sell EUR-denominated tickets by
card, manage inventory and attendees, run a controlled resale marketplace, scan
tickets at the door, and issue ticket NFTs on Base Sepolia through Thirdweb.

The core platform is Next.js 15, Supabase Auth/Postgres/RLS, Stripe Connect
marketplace payments, Thirdweb ERC-721 ticket operations, and optional AI/email/
rate-limiting/monitoring integrations.

## Buyer Features

- Organization storefronts at `/s/[organizationSlug]` with search, date, city,
  genre, vibe, price, festival, and sort filters.
- Organization event pages at `/s/[organizationSlug]/events/[eventSlug]`.
- Legacy global discovery routes at `/events` and `/events/[id]`.
- Global marketplace at `/marketplace` and organization-scoped marketplace pages.
- Stripe card checkout for primary ticket sales with quantity, promo codes,
  club-table extras, gifts, idempotency, and success/cancel return pages.
- Resale listing creation and resale checkout.
- Ticket wallet at `/tickets`, including wallet-transfer API support.
- Organization following, waitlists, unsubscribe links, calendar ICS export, and
  transactional email paths when email credentials are configured.
- Buyer AI assistant and escalation routes when AI credentials are configured.

## Organizer Features

- Smartboard workspace with events, marketing, promos, analytics, banking, and
  page-management tabs.
- Organization creation, switching, branding/theme updates, royalty settings,
  team membership, transfer, and delete actions.
- Event creation, editing, publishing, unpublishing, canceling, duplicating, and
  contract-publish retry workflows.
- Ticket-category management, including standard tickets, club-table style
  packages, gift/extras handling, sale windows, inventory, and promo codes.
- Attendee export, analytics export, refund actions, marketplace-payment refund
  actions, and mint retry actions.
- Stripe Connect onboarding, seller payout readiness, payout dashboard, and
  marketplace settlement/reconciliation cron routes.
- Storefront site settings, custom domain support through Vercel credentials, and
  embeddable category widgets at `/embed/[categoryId]`.
- Follower marketing and announcement composition.
- Organizer AI copilot and organization-context reindexing when AI credentials
  are configured.

## Controller And Gate Features

- Controller dashboard and event-specific controller views.
- Controller invitations from organizers.
- Gate session open/close flows with optional ticket-category scopes.
- QR redemption prepare/confirm APIs.
- Optional rotating gate-token validation using `MISO_GATE_ROTATION_SECRET`.
- Database-first redemption state with best-effort on-chain redeemed attribute
  updates.

## Platform Features

- Supabase Auth, Postgres migrations, RLS-oriented server flows, and service-role
  server operations.
- Stripe Connect separate charges and transfers for primary and resale sales,
  webhook fulfillment, refunds, disputes, transfer tracking, and settlement
  sweeps.
- Thirdweb contract deployment, ticket minting, admin transfers, storage upload,
  and chain operation tracking.
- Optional Upstash Redis rate limiting; local fallback is available when Redis is
  absent.
- Optional Resend email delivery; flows no-op or degrade when unset.
- Optional Sentry monitoring.
- Optional Vercel Domains API support for custom storefront domains.
- Demo seed data with organizations, users, events, categories, purchases, and
  payout-ready seller accounts.

## Current Boundaries

- Base Sepolia is the configured chain target in this repo.
- PayZone is not implemented; payment code uses Stripe Connect and local mock
  helpers where applicable.
- AI features are gated by Anthropic/OpenAI environment variables.
- Email, Redis, Sentry, and Vercel domain features are optional integrations.
- The global `/events` routes still exist, but the primary product model is
  organization-scoped storefronts.
