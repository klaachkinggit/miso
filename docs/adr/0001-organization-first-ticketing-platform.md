# Organization-first ticketing platform

Miso will move from a single global billeterie into an organization-first ticketing platform: each organizer owns an Organization with its own public subdomain, events, sales channels, marketplace, legal profile, team, and payout setup. We chose this model over a global Miso marketplace or per-user organizer ownership because it matches the Weezevent-style operating model the product is targeting, keeps buyer experiences scoped to the organizer's billeterie, and lets Miso use the same system internally as one Organization.

**Considered Options**

- Keep Miso as one global ticketing marketplace.
- Model organizer ownership directly on individual profiles.
- Model organizer ownership through Organizations and memberships.

**Consequences**

- Public buyer routes resolve through an Organization first, for example `{organization}.miso.com/events/{eventSlug}`.
- Stripe Connect accounts, legal profile, payout settings, events, sales channels, analytics, and resale marketplaces belong to Organizations.
- A Platform account can buy across Organizations and can administer multiple Organizations through memberships.
- The existing global event and marketplace surfaces are legacy migration surfaces, not the MVP buyer path.
