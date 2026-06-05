# Miso Platform Migration Plan

Miso is becoming a Weezevent-style platform where organizers create their own billeterie. The current ticketing system remains the engine behind every Organization.

## Product Shape

- Canonical container: `Organization`.
- Buyer URL: `{organizationSlug}.miso.com`.
- Event URL: `{organizationSlug}.miso.com/events/{eventSlug}`.
- Organization marketplace URL: `{organizationSlug}.miso.com/marketplace`.
- Admin workspace URL: `app.miso.com`.
- Local development fallback: `/s/[organizationSlug]`.

## Commercial Model

- Currency: EUR.
- Primary ticket sales: buyer pays `face value + Miso fee + Stripe fee`.
- Organizer receives near face value.
- Stripe Connect account belongs to the Organization.
- Paid sales are blocked until the Organization's Stripe account can accept charges.
- Resale royalty is optional per Organization or event and is off by default for MVP.
- When resale royalty is enabled, buyer pays `seller listing price + royalty + Miso fee + Stripe fee`; seller receives the listing price.

## Identity And Access

- One global Platform account works across all Organizations.
- Every completed purchase must be linked to a Platform account.
- Organizations only see their own customer and attendee data.
- Organization roles:
  - `admin`: full control, including legal, billing, payouts, team, events, settings, transfer, and deletion.
  - `controller`: gate scan only for assigned events and gates.

## Migration Slices

1. Create Organization schema, memberships, settings, and backfill existing events into a Miso-owned Organization.
2. Add organization-aware auth helpers and replace global profile role assumptions in organizer flows.
3. Add admin Organization switcher and scope event management to selected Organization.
4. Add public Organization resolver for subdomains and `/s/[organizationSlug]` local fallback.
5. Move event pages to Organization-scoped slugs while keeping legacy global routes hidden during transition.
6. Scope marketplace listings, resale checkout, and royalties to Organization.
7. Move Stripe Connect onboarding and payout readiness from Profile to Organization.
8. Track `sales_channel` and optional `tracking_origin` on purchase and resale flows.
9. Hide legacy global discovery surfaces from navigation.
10. Remove or clearly quarantine legacy per-profile organizer ownership after migration is stable.

## Guardrails

- Keep NFT details invisible in normal buyer UI. Use "digital ticket", "ticket wallet", "secure resale", and "verified entry".
- Keep current on-chain mint, transfer, and redemption engine as the backend implementation.
- Do not let controller accounts buy, list, or checkout through an Organization where they are controllers.
- Preserve idempotency around Stripe checkout, webhook fulfillment, minting, transfer, and reservation expiry.
- Make tenant scoping explicit in code: Organization-first paths should not silently fall back to global queries.
