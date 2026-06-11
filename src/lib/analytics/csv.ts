// Multi-block CSV serializer for the Organization Analytics dashboard
// export. Each section is a self-contained CSV preceded by a `# Title`
// comment line; sections are separated by a blank line so spreadsheets
// open the file as a single sheet while a reader can still split it
// programmatically by `\n\n` boundaries.

import type {
  AnalyticsChannelStat,
  AnalyticsEventStat,
  AnalyticsRange,
  AnalyticsTimeBucket,
  AnalyticsTotals,
  OrganizationAnalytics,
} from "@/lib/analytics/organization";

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cells: unknown[]): string {
  return cells.map(escapeCsvField).join(",");
}

function isoDate(d: Date): string {
  return d.toISOString();
}

function totalsBlock(title: string, range: AnalyticsRange | null, totals: AnalyticsTotals): string {
  const lines = [
    `# ${title}`,
    "metric,value",
  ];
  if (range) {
    lines.push(row("range_preset", range.preset));
    lines.push(row("range_from", isoDate(range.from)));
    lines.push(row("range_to", isoDate(range.to)));
  }
  lines.push(row("currency", totals.currency));
  lines.push(row("gross_revenue", totals.gross_revenue));
  lines.push(row("tickets_sold", totals.tickets_sold));
  lines.push(row("sellout_rate", totals.sellout_rate));
  lines.push(row("refund_rate", totals.refund_rate));
  return lines.join("\n");
}

function timeseriesBlock(series: AnalyticsTimeBucket[]): string {
  const lines = ["# Time series", "bucket,revenue,tickets"];
  for (const bucket of series) {
    lines.push(row(bucket.bucket, bucket.revenue, bucket.tickets));
  }
  return lines.join("\n");
}

function channelsBlock(channels: AnalyticsChannelStat[]): string {
  const lines = ["# Sales channels", "channel,revenue,tickets,share"];
  for (const c of channels) {
    lines.push(row(c.channel, c.revenue, c.tickets, c.share));
  }
  return lines.join("\n");
}

function eventsBlock(events: AnalyticsEventStat[]): string {
  const lines = [
    "# Per-event performance",
    "event_id,name,date,city,venue,capacity,tickets_sold,tickets_redeemed,revenue_paid,attendance_rate,sellout_rate",
  ];
  for (const e of events) {
    lines.push(
      row(
        e.event_id,
        e.name,
        e.date,
        e.city,
        e.venue_name,
        e.capacity,
        e.tickets_sold,
        e.tickets_redeemed,
        e.revenue_paid,
        e.attendance_rate,
        e.sellout_rate,
      ),
    );
  }
  return lines.join("\n");
}

export function serializeAnalyticsCsv(analytics: OrganizationAnalytics): string {
  const blocks: string[] = [];
  blocks.push(totalsBlock("Totals", analytics.range, analytics.totals));
  if (analytics.priorTotals) {
    blocks.push(totalsBlock("Prior totals", analytics.prior, analytics.priorTotals));
  }
  blocks.push(timeseriesBlock(analytics.timeseries));
  blocks.push(channelsBlock(analytics.salesChannelBreakdown));
  blocks.push(eventsBlock(analytics.events));
  return blocks.join("\n\n");
}
