# Miso SaaS v1 Plan

Historical ship plan. As of 2026-06-15, P0 and P1 are shipped and merged to `development`; use this file only for the remaining P2 backlog and historical pointers.

Current sources of truth:

- Domain glossary: `docs/CONTEXT.md`
- Current handoff: `docs/handoffs/2026-06-15-v1-complete.md`
- Architecture decisions: `docs/adr/`
- Infra/deploy runbook: `docs/ci-and-deploy.md`

Shipped scope:

- One marketplace checkout stack; legacy checkout decommissioned.
- Organization-scoped storefronts, analytics, themes, custom domains, waitlists, followers, promo codes, embed checkout, transactional email, rate limiting, CI, and production runbooks.
- Stripe marketplace settlement with separate charges/transfers, fulfillment-before-transfer, manual refunds, and reconciliation crons.
- P1.6 AI: org-admin copilot plus org-scoped buyer assistant/RAG.
- Operator Editorial landing redesign and rotating gate QR.

Remaining P2 backlog:

- Post-event attendance badge airdrop on existing ERC-721 rails.
- Admin chain-ops repair console.
- Platform billing/plans via Stripe Billing.
- Token-gated presales, referral loops, and multi-member org-role UI polish.

Execution rules still apply: branch from integration work, target PRs at `development`, keep `main` deployment-only, and run the repo preflight before PR/deploy work.
