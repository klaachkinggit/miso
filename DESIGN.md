# Miso Public UI Design

## Visual Theme

Miso public pages use an editorial ticket-office language: large venue-grade typography, dense program information, crisp borders, and one signal color per storefront. The interface should feel like an official billetterie, not a generic SaaS marketing site.

## Color Roles

- `--background`: page canvas.
- `--foreground`: primary text.
- `--card`: event cards, exchange rows, and ticket panels.
- `--muted-foreground`: secondary copy and metadata.
- `--signal`: one high-priority action/accent color.
- `--hairline`: structural borders and dividers.

Storefront presets are closed sets in `src/lib/organizations/theme.ts`. Never persist or interpolate arbitrary CSS from users.

## Typography

- Display type uses `var(--font-display)` and no negative letter spacing.
- Metadata uses `var(--font-mono)` with uppercase labels and generous positive tracking.
- Body text stays at 16px or larger on mobile with relaxed line-height.
- Prices and counters use tabular-feeling display treatment and must not shift layout.

## Components

- Storefront hero: branded name, official billetterie marker, primary event CTA, exchange CTA, optional hero image.
- Event cards: template-driven via `data-card-variant`; variants are `poster`, `ticket`, and `ledger`.
- Storefront templates: selected via `organizations.theme = { preset }`; real public pages consume `data-hero-layout` and `data-card-variant`.
- Buttons: one primary signal action per view; secondary actions are bordered and quiet.
- Cards: radius stays restrained, 8px or less unless inherited component defaults require otherwise.

## Layout

- Buyer pages are mobile-first and use full-width public bands with constrained container content.
- Avoid nested cards. Use cards only for repeated items, ticket tiers, modals, or framed tools.
- Hero layouts are `centered`, `split`, and `minimal`; all must keep the next section discoverable below the first viewport when practical.
- Event grids must not horizontally overflow on 375px screens.

## Accessibility

- Interactive targets are at least 44px high.
- Icon buttons need labels; structural icons use Lucide.
- Focus states remain visible.
- Color is not the only information channel for ticket availability or destructive states.
- Motion must respect `prefers-reduced-motion`.

## Do Not

- Do not add decorative blobs, generic purple-blue gradients, or nested SaaS card stacks.
- Do not use arbitrary per-organization CSS.
- Do not overhaul organizer dashboard UI when working on public billetterie templates, except the template picker/preview surface.
