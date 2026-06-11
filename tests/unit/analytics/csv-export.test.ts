import { describe, expect, it } from "vitest";

import {
  serializeAnalyticsCsv,
  escapeCsvField,
} from "@/lib/analytics/csv";
import type { OrganizationAnalytics } from "@/lib/analytics/organization";

function makeAnalytics(): OrganizationAnalytics {
  return {
    range: { preset: "7d", from: new Date("2026-06-04T00:00:00Z"), to: new Date("2026-06-11T00:00:00Z") },
    prior: { preset: "7d", from: new Date("2026-05-28T00:00:00Z"), to: new Date("2026-06-04T00:00:00Z") },
    totals: {
      gross_revenue: 190,
      tickets_sold: 3,
      sellout_rate: 0.4667,
      refund_rate: 0.25,
      currency: "EUR",
    },
    priorTotals: {
      gross_revenue: 40,
      tickets_sold: 1,
      sellout_rate: 0.4667,
      refund_rate: 0,
      currency: "EUR",
    },
    timeseries: [
      { bucket: "2026-06-04", revenue: 0, tickets: 0 },
      { bucket: "2026-06-05", revenue: 50, tickets: 1 },
      { bucket: "2026-06-06", revenue: 80, tickets: 1 },
      { bucket: "2026-06-07", revenue: 60, tickets: 1 },
    ],
    salesChannelBreakdown: [
      { channel: "primary", revenue: 130, tickets: 2, share: 0.684 },
      { channel: "marketplace", revenue: 60, tickets: 1, share: 0.316 },
    ],
    events: [
      {
        event_id: "e1",
        name: "Open air",
        date: "2026-07-01",
        city: "Berlin",
        venue_name: "Park",
        status: "published",
        capacity: 200,
        tickets_sold: 110,
        tickets_redeemed: 2,
        revenue_paid: 130,
        currency: "EUR",
        attendance_rate: 0.018,
        sellout_rate: 0.55,
      },
    ],
  };
}

describe("escapeCsvField", () => {
  it("returns plain values untouched", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField(42)).toBe("42");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("serializeAnalyticsCsv", () => {
  it("emits totals, prior, time series, channels, and events blocks separated by blank lines", () => {
    const csv = serializeAnalyticsCsv(makeAnalytics());
    const blocks = csv.split("\n\n");
    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(blocks[0]).toMatch(/^# Totals/);
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^# Time series/),
        expect.stringMatching(/^# Sales channels/),
        expect.stringMatching(/^# Per-event/),
      ]),
    );
  });

  it("includes the gross revenue value for the current range in the totals block", () => {
    const csv = serializeAnalyticsCsv(makeAnalytics());
    const totalsBlock = csv.split("\n\n")[0];
    expect(totalsBlock).toContain("gross_revenue");
    expect(totalsBlock).toContain("190");
  });

  it("escapes commas inside event names", () => {
    const a = makeAnalytics();
    a.events[0].name = "Open air, with strings";
    const csv = serializeAnalyticsCsv(a);
    expect(csv).toContain('"Open air, with strings"');
  });

  it("omits the prior block when priorTotals is null", () => {
    const a = makeAnalytics();
    a.priorTotals = null;
    a.prior = null;
    const csv = serializeAnalyticsCsv(a);
    expect(csv).not.toMatch(/^# Prior totals/m);
  });

  it("renders the time series block with bucket, revenue, tickets columns", () => {
    const csv = serializeAnalyticsCsv(makeAnalytics());
    const block = csv.split("\n\n").find((b) => b.startsWith("# Time series")) ?? "";
    const lines = block.split("\n");
    expect(lines[1]).toBe("bucket,revenue,tickets");
    expect(lines).toContain("2026-06-05,50,1");
  });
});
