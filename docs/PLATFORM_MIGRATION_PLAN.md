# Miso Platform Migration Plan

Miso is becoming a Weezevent-style platform where organizers create their own billeterie. The current ticketing system remains the engine behind every Organization.

## Product Shape

- Canonical container: `Organization`.
- Buyer URL: `{organizationSlug}.miso.com`.
- Event URL: `{organizationSlug}.miso.com/events/{eventSlug}`.
- Organization marketplace URL: `{organizationSlug}.miso.com/marketplace`.
- Admin workspace URL: `app.miso.com`.
- Local development fallback: `/s/[organizationSlug]`.
- Host resolver rewrites `{organizationSlug}.miso.com` and `{organizationSlug}.shop.miso.com` to the fallback route internally. Reserved platform hosts such as `app`, `admin`, `api`, `shop`, and `www` are not valid Organization subdomains.

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

## Implemented Platform Slices

- Slice 1: Organization schema and transition backfill added in `20260605004939_organization_foundation.sql`.
- Slice 2: Organization-aware auth helpers now protect admin, controller, checkout, and marketplace boundaries.
- Slice 3: Admin workspace selection uses the server-validated `miso_active_organization_id` cookie. Invalid or tampered selections fall back to an Organization the account administers. Event lists, analytics, and event creation use the active Organization, with legacy profile-owned events only as transition fallback when no Organization membership exists.
- Slice 4: Public Organization storefront fallback routes exist at `/s/[organizationSlug]`, `/s/[organizationSlug]/events/[eventSlug]`, and `/s/[organizationSlug]/marketplace`. Event slugs are unique inside one Organization, and org-scoped pages do not fall back to global event or marketplace queries.
- Slice 5: Organization host routing maps public storefront subdomains to the same fallback routes while keeping app/API/admin paths out of tenant routing. Storefront pages emit clean subdomain-local links when visited through the Organization host.
- Slice 6: Organization admins can edit public storefront branding and resale royalty settings from `/admin/settings`. Branding lives in `organizations.branding`; royalties use `organizations.resale_royalty_enabled` and `organizations.resale_royalty_bps`.
- Slice 7: Resale checkout includes optional buyer-paid Organization royalties. Seller still receives the listing price; buyer pays listing price plus royalty plus Miso marketplace fee.
- Slice 9: Paid primary and resale checkout are blocked unless the Organization has a Stripe account id, submitted details, and charges enabled. The local demo seed marks Miso's Organization ready so mocked checkout remains usable.
- Slice 8: Primary and resale checkout persist server-derived `sales_channel` and bounded `tracking_origin` values. Primary ticket checkout records `mini_site`; resale checkout records `marketplace`.
- Slice 10: Persistent shared navigation no longer promotes legacy global `/events` or `/marketplace` discovery. Those routes remain available by direct URL during transition.
- Slice 11: Primary checkout charges buyer-paid MISO service fees and estimated Stripe processing fees as separate Checkout line items, and persists `platform_fee_amount`, `stripe_fee_amount`, and `buyer_total_amount` on purchase rows.
- Slice 12: Resale checkout charges buyer-paid Stripe processing fees on top of seller price, MISO marketplace fee, and optional Organizer royalty. `resale_listings.stripe_fee_amount` stores the fee used for settlement analytics.
- Slice 13: Organization settings include team management and ownership controls. Admins can transfer an Organization to another Platform account, which makes the recipient an Organization admin and updates `organizations.created_by_user_id`. Admins can delete only empty Organizations; linked Stripe accounts, existing events, purchases, customers, or resale listings block deletion.
- Slice 14: Stripe Connect onboarding is explicitly Organization-first. New organizer signup stores onboarding answers on the Organization, and the remaining profile Stripe writes are isolated as transition mirrors inside `src/lib/payments/stripe-connect.ts` for older code paths.
- Slice 15: The public landing page no longer promotes the legacy global `/marketplace` exchange through hero chips, fan CTAs, or the sitemap. Organization marketplaces remain public inside each billeterie.
