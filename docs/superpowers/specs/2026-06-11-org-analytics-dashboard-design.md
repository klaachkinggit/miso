# Organization Analytics Dashboard — Design

**Date:** 2026-06-11
**Branch:** `feat/org-analytics-dashboard`
**Status:** Draft → user review

## Goal

Give Organization admins a premium-SaaS-grade analytics surface focused on **revenue and sales**, scoped to the Active Organization, with time-range comparison, filters, charts, drilldown, and CSV export.

This is a new buyer-facing surface for the Organizer workspace. It does not modify any existing settlement, mint, or marketplace flow.

## Non-Goals (v1)

- Attendance / gate-ops analytics (redemption breakdowns beyond a single attendance KPI).
- Resale marketplace analytics (volume, royalty earned).
- Customer cohorts (repeat-buyer rates, geographic breakdown).
- Realtime updates / WebSocket subscriptions.
- Saved views, scheduled exports, email digests.
- Postgres materialized views or rollup tables.

Those land in follow-up iterations once the v1 loader shape is proven.

## Surface

- Route: `src/app/admin/analytics/page.tsx` (server component).
- Navigation: add `Analytics` link in admin layout chrome next to Events/Settings/Site.
- Scope: respects Active Organization via `getActiveAdminOrganization`. Empty-org state mirrors `/admin` page.
- Auth: `requireOrganizerWorkspace()` + active-org membership assertion. Controllers cannot access (same as other admin pages).

URL contract — all view state lives in search params so the page is shareable and cache-friendly:

```
/admin/analytics
  ?range=7d                           # preset OR `custom`
  &from=2026-06-01&to=2026-06-08      # only when range=custom
  &compare=prior                      # `prior` | `none`, default `prior`
  &events=evt_1,evt_2                 # optional event filter
  &channels=primary,marketplace       # optional sales channel filter
  &categories=cat_1                   # optional category filter
```

## Data Layer

### Module

New module: `src/lib/analytics/organization.ts`. The existing `src/lib/analytics/organizer.ts` (which powers the `/admin` overview tiles) stays untouched.

### Loader interface

```ts
export interface AnalyticsRange {
  from: Date;
  to: Date;
  preset: "today" | "7d" | "30d" | "90d" | "ytd" | "all" | "custom";
}

export interface AnalyticsFilters {
  eventIds?: string[];
  salesChannels?: string[];
  categoryIds?: string[];
}

export interface OrganizationAnalytics {
  range: AnalyticsRange;
  prior: AnalyticsRange | null;
  totals: {
    gross_revenue: number;     // sum of paid purchase amounts
    tickets_sold: number;      // sum of category.sold_count (scoped) OR count of paid purchases (we use purchases for time-range fidelity)
    sellout_rate: number;      // tickets_sold / supply across scoped categories
    refund_rate: number;       // refunded purchases / paid purchases
    currency: Currency;
  };
  priorTotals: OrganizationAnalytics["totals"] | null;
  timeseries: Array<{ bucket: string; revenue: number; tickets: number }>;
  salesChannelBreakdown: Array<{ channel: string; revenue: number; tickets: number; share: number }>;
  events: OrganizerEventStat[]; // reuse shape from organizer.ts
}

export async function loadOrganizationAnalytics(params: {
  organizationId: string;
  range: AnalyticsRange;
  compare: "prior" | "none";
  filters: AnalyticsFilters;
}): Promise<OrganizationAnalytics>;
```

### Query strategy

Four parallel `service-role` queries (no RLS — the page is gated):

1. `events` for the organization — id, name, date, status, organization_id (filter by `organizationId`, optionally by `filters.eventIds`).
2. `purchases` scoped to those event ids — status, amount, currency, event_id, sales_channel, created_at, refunded_at. Window: `range.from..range.to` if `range.preset !== 'all'`, plus the prior window when `compare='prior'`.
3. `ticket_categories` scoped to those event ids — id, supply, sold_count, currency.
4. `tickets` scoped to those event ids — status (for refund + redemption counts).

In-memory aggregation:

- Time series: bucket paid purchases by `created_at` into the chosen range. Bucket size derived from range:
  - `today` → 1h buckets
  - `7d`/`30d` → 1d buckets
  - `90d`/`ytd`/`all` → 1w buckets
  - `custom` → 1d if span ≤ 60d, else 1w
- Sales channel breakdown: group paid purchases by `sales_channel`.
- Sellout rate: scoped supply vs scoped sold_count (independent of range — capacity is event-lifetime, not window-bound).
- Refund rate: refunded count / paid count in range.

### Prior period

When `compare='prior'`, derive prior range as `{ from: range.from - (range.to - range.from), to: range.from }`. Re-run the purchases query once for that window. Compute the same `totals` shape. Component renders delta = `(current - prior) / prior`.

### Indexes

Migration: `supabase/migrations/{ts}_analytics_purchases_index.sql`. Adds:

```sql
create index if not exists purchases_event_created_at_idx
  on purchases (event_id, created_at desc);
```

Backed by `EXPLAIN` against representative volume — added if it changes plan from seq-scan to index-scan.

## Components

All in `src/app/admin/analytics/_components/`:

| Component | Type | Responsibility |
|---|---|---|
| `kpi-row.tsx` | server | 4 tiles: gross revenue, tickets sold, sellout %, refund %. Each tile renders value + delta vs prior. |
| `revenue-timeseries.tsx` | server (chart) + client (tooltip) | Custom SVG area chart. Motion-driven path-draw on mount. Client island handles hover bisect + tooltip. |
| `sales-channel-breakdown.tsx` | server | Horizontal SVG bar chart by sales channel, share % labels. |
| `event-table.tsx` | server | Sortable rows (sort via search param). Row click → `/admin/events/[id]`. Reuses `OrganizerEventStat` shape. |
| `filter-chips.tsx` | client | Multi-select event / sales channel / category. URL-synced (replace router push). |
| `range-picker.tsx` | client | Preset chips + custom range popover. URL-synced. |
| `export-button.tsx` | client | Download trigger; POSTs to `/api/analytics/export` and saves the response as `analytics.csv`. |

Page composition: server component reads search params → calls `loadOrganizationAnalytics` once → passes data into presentational children. Client islands only for filter/range/export.

## CSV Export

- Route: `src/app/api/analytics/export/route.ts` (`POST`, JSON body with same filters as the page query).
- Auth: `requireApiNonControllerProfile` + active-org membership assertion.
- Calls the same `loadOrganizationAnalytics` loader — single source of truth.
- Serializes to a multi-block CSV: KPIs row, time series block, per-channel block, per-event block, separated by blank lines.
- Returns `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename=...`.

## Tests

- `tests/unit/analytics/organization.test.ts`
  - Revenue sum across paid purchases.
  - Sellout rate respects scoped categories.
  - Bucket boundary correctness across each preset.
  - Prior-period split (delta math).
  - Filter application (event / channel / category).
  - Empty-org early return.
- `tests/unit/analytics/csv-export.test.ts`
  - Header rows for each block.
  - Escape semantics: commas, quotes, newlines in event names.
  - Currency formatting.
- Components stay snapshot-free. Light DOM assertions for chart svg `path` shape only if value emerges; not a goal.

## Security

- Page + export both call active-org membership check before any query.
- `service-role` client used only inside the loader. Page passes only org id; loader trusts the caller.
- CSV export filename + body do not leak unrelated org names (filename derived from org slug).
- No new external network calls. No new env vars.

## Architecture Alignment

This implementation embodies the **deep loader, shallow handlers** shape from the architecture review (candidate #1). One loader powers two surfaces (page + export); both surfaces are thin adapters over it. When candidate #1 (Active Organization resolve) ships, both surfaces inherit the deeper seam automatically without changing the loader.

## Open Questions

None remaining for v1. Follow-up scope (attendance, resale, cohorts, materialized rollups) is explicitly out per the Non-Goals.

## Deliverables

1. Migration: `supabase/migrations/{ts}_analytics_purchases_index.sql`.
2. Module: `src/lib/analytics/organization.ts`.
3. Page: `src/app/admin/analytics/page.tsx` + `_components/*`.
4. Export route: `src/app/api/analytics/export/route.ts`.
5. Nav update: admin layout chrome.
6. Tests: `tests/unit/analytics/organization.test.ts`, `tests/unit/analytics/csv-export.test.ts`.
7. Glossary update: `docs/CONTEXT.md` — add `Analytics range`, `Prior period comparison`, `Sales channel breakdown`.
