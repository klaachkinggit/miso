import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CircleDollarSign,
  Percent,
  Receipt,
  TicketCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { loadOrganizationAnalytics } from "@/lib/analytics/organization";
import { formatDateShort, formatPrice } from "@/lib/format";
import {
  ActiveAdminOrganizationRequired,
  requireActiveAdminOrganization,
} from "@/lib/organizations/context";
import { createServiceClient } from "@/lib/supabase/service";
import { ChannelBars } from "./_components/channel-bars";
import { CategoryTable } from "./_components/category-table";
import { EventTable } from "./_components/event-table";
import { ExportButton } from "./_components/export-button";
import { FilterChips } from "./_components/filter-chips";
import { KpiTile } from "./_components/kpi-tile";
import { RangePicker } from "./_components/range-picker";
import { RevenueChart } from "./_components/revenue-chart";
import { parseAnalyticsSearchParams } from "@/lib/analytics/search-params";

const SALES_CHANNELS: Array<{ id: string; label: string }> = [
  { id: "mini_site", label: "Primary mini-site" },
  { id: "marketplace", label: "Marketplace" },
  { id: "qr", label: "QR" },
  { id: "widget", label: "Embed widget" },
  { id: "ticket_office", label: "Ticket office" },
  { id: "invitation", label: "Invitation" },
  { id: "import", label: "Import" },
];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function OrganizationAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [raw, profile] = await Promise.all([
    searchParams ??
      Promise.resolve({} as Record<string, string | string[] | undefined>),
    requireOrganizerWorkspace(),
  ]);
  let organizations: Awaited<
    ReturnType<typeof requireActiveAdminOrganization>
  >["organizations"];
  let activeOrganization: Awaited<
    ReturnType<typeof requireActiveAdminOrganization>
  >["activeOrganization"];
  try {
    ({ organizations, activeOrganization } =
      await requireActiveAdminOrganization(profile));
  } catch (error) {
    if (error instanceof ActiveAdminOrganizationRequired) redirect("/admin");
    throw error;
  }

  const parsed = parseAnalyticsSearchParams(raw);
  const analytics = await loadOrganizationAnalytics({
    organizationId: activeOrganization.id,
    range: parsed.range,
    compare: parsed.compare,
    filters: parsed.filters,
  });

  // Build event filter options from the org's events (independent of range filters so the
  // user can broaden the filter without losing the chip list).
  const sb = createServiceClient();
  const { data: allEventsForFilter } = await sb
    .from("events")
    .select("id, name")
    .eq("organization_id", activeOrganization.id)
    .order("date", { ascending: false })
    .limit(50);

  return (
    <div className="container py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow-signal">{activeOrganization.name}</p>
          <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">
            Analytics<span className="display-italic text-signal">.</span>
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Revenue, sales velocity, channel mix — scoped to this organization.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <ExportButton
            organizationId={activeOrganization.id}
            organizationSlug={activeOrganization.slug ?? "organization"}
          />
        </div>
      </div>

      <div className="mb-8 space-y-4">
        <RangePicker current={parsed.range.preset} compare={parsed.compare} />
        <p className="text-xs text-muted-foreground">
          {formatDateShort(parsed.range.from.toISOString())} →{" "}
          {formatDateShort(parsed.range.to.toISOString())}
          {parsed.prior ? (
            <>
              {" "}
              vs {formatDateShort(parsed.prior.from.toISOString())} →{" "}
              {formatDateShort(parsed.prior.to.toISOString())}
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={CircleDollarSign}
          label="Gross revenue"
          value={formatPrice(
            analytics.totals.gross_revenue,
            analytics.totals.currency,
          )}
          hint={`${analytics.totals.tickets_sold} tickets paid`}
          current={analytics.totals.gross_revenue}
          prior={analytics.priorTotals?.gross_revenue ?? null}
        />
        <KpiTile
          icon={TicketCheck}
          label="Tickets sold"
          value={`${analytics.totals.tickets_sold}`}
          hint={`${analytics.events.length} events in scope`}
          current={analytics.totals.tickets_sold}
          prior={analytics.priorTotals?.tickets_sold ?? null}
        />
        <KpiTile
          icon={Percent}
          label="Sellout"
          value={percent(analytics.totals.sellout_rate)}
          hint="Across all categories"
          current={analytics.totals.sellout_rate}
          prior={analytics.priorTotals?.sellout_rate ?? null}
        />
        <KpiTile
          icon={Receipt}
          label="Refund rate"
          value={percent(analytics.totals.refund_rate)}
          hint="Refunded ÷ settled"
          current={analytics.totals.refund_rate}
          prior={analytics.priorTotals?.refund_rate ?? null}
          invertDelta
        />
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-md border border-hairline bg-ink-raised p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="eyebrow">Revenue over time</p>
              <h2 className="display mt-1.5 text-xl text-foreground">
                Sales velocity.
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {analytics.timeseries.length} buckets
            </span>
          </div>
          <RevenueChart
            series={analytics.timeseries}
            currency={analytics.totals.currency}
          />
        </section>
        <section className="rounded-md border border-hairline bg-ink-raised p-6">
          <div className="mb-4">
            <p className="eyebrow">Channel mix</p>
            <h2 className="display mt-1.5 text-xl text-foreground">
              Where it sold.
            </h2>
          </div>
          <ChannelBars
            channels={analytics.salesChannelBreakdown}
            currency={analytics.totals.currency}
          />
        </section>
      </div>

      {analytics.categoryBreakdown.length > 0 && (
        <div className="mt-8">
          <section className="rounded-md border border-hairline bg-ink-raised p-6">
            <div className="mb-4">
              <p className="eyebrow">Top categories</p>
              <h2 className="display mt-1.5 text-xl text-foreground">
                By revenue.
              </h2>
            </div>
            <CategoryTable rows={analytics.categoryBreakdown} />
          </section>
        </div>
      )}

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_3fr]">
        <aside className="rounded-md border border-hairline bg-ink-raised p-6">
          <p className="eyebrow">Filters</p>
          <h2 className="display mt-1.5 text-xl text-foreground">
            Narrow down.
          </h2>
          <div className="mt-4">
            <FilterChips
              events={(allEventsForFilter ?? []).map((e) => ({
                id: e.id,
                label: e.name,
              }))}
              channels={SALES_CHANNELS}
              selectedEvents={parsed.filters.eventIds ?? []}
              selectedChannels={parsed.filters.salesChannels ?? []}
            />
          </div>
        </aside>
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="eyebrow">Per-event performance</p>
              <h2 className="display mt-1.5 text-xl text-foreground">
                Live ledger.
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/api/admin/analytics/export?range=${parsed.range.preset}`}
                download
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Download CSV
              </a>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/events">All events →</Link>
              </Button>
            </div>
          </div>
          <EventTable events={analytics.events} />
        </section>
      </div>

      {organizations.length > 1 ? (
        <p className="mt-12 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <BarChart3 className="h-3 w-3" /> Switch the active organization in
          the top nav to view another scope.
        </p>
      ) : null}
    </div>
  );
}
