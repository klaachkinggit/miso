import { describe, expect, it } from "vitest";

import {
  aggregateOrganizationAnalytics,
  aggregateCategoryBreakdown,
  computePriorRange,
  rangePresetWindow,
  type AnalyticsCategoryRow,
  type AnalyticsEventRow,
  type AnalyticsPurchaseRow,
  type AnalyticsRange,
  type AnalyticsTicketRow,
} from "@/lib/analytics/organization";

const REF_NOW = new Date("2026-06-11T12:00:00.000Z");

function range(
  preset: AnalyticsRange["preset"],
  from: string,
  to: string,
): AnalyticsRange {
  return { preset, from: new Date(from), to: new Date(to) };
}

function makeRows(): {
  events: AnalyticsEventRow[];
  categories: AnalyticsCategoryRow[];
  purchases: AnalyticsPurchaseRow[];
  tickets: AnalyticsTicketRow[];
} {
  const events: AnalyticsEventRow[] = [
    {
      id: "e1",
      name: "Open air",
      date: "2026-07-01",
      city: "Berlin",
      venue_name: "Park",
      status: "published",
      capacity: 200,
    },
    {
      id: "e2",
      name: "Club night",
      date: "2026-08-15",
      city: "Lyon",
      venue_name: "Cave",
      status: "published",
      capacity: 100,
    },
  ];
  const categories: AnalyticsCategoryRow[] = [
    {
      id: "c1",
      event_id: "e1",
      supply: 150,
      sold_count: 90,
      currency: "EUR",
      name: "General",
    },
    {
      id: "c2",
      event_id: "e1",
      supply: 50,
      sold_count: 20,
      currency: "EUR",
      name: "VIP",
    },
    {
      id: "c3",
      event_id: "e2",
      supply: 100,
      sold_count: 30,
      currency: "EUR",
      name: "Balcony",
    },
  ];
  const purchases: AnalyticsPurchaseRow[] = [
    // in-range, paid
    {
      event_id: "e1",
      ticket_id: "t1",
      amount: 50,
      currency: "EUR",
      status: "paid",
      sales_channel: "mini_site",
      created_at: "2026-06-05T10:00:00Z",
    },
    {
      event_id: "e1",
      ticket_id: "t2",
      amount: 80,
      currency: "EUR",
      status: "paid",
      sales_channel: "mini_site",
      created_at: "2026-06-06T10:00:00Z",
    },
    {
      event_id: "e2",
      ticket_id: "t3",
      amount: 60,
      currency: "EUR",
      status: "paid",
      sales_channel: "marketplace",
      created_at: "2026-06-07T10:00:00Z",
    },
    // in-range, refunded
    {
      event_id: "e1",
      ticket_id: "t4",
      amount: 50,
      currency: "EUR",
      status: "refunded",
      sales_channel: "mini_site",
      created_at: "2026-06-07T10:00:00Z",
    },
    // before range — prior period
    {
      event_id: "e1",
      ticket_id: "t5",
      amount: 40,
      currency: "EUR",
      status: "paid",
      sales_channel: "mini_site",
      created_at: "2026-05-30T10:00:00Z",
    },
    // after range
    {
      event_id: "e1",
      ticket_id: "t6",
      amount: 99,
      currency: "EUR",
      status: "paid",
      sales_channel: "mini_site",
      created_at: "2026-06-20T10:00:00Z",
    },
  ];
  const tickets: AnalyticsTicketRow[] = [
    {
      id: "t1",
      event_id: "e1",
      category_id: "c1",
      status: "used",
      used_at: "2026-06-05T12:00:00Z",
    },
    {
      id: "t2",
      event_id: "e1",
      category_id: "c2",
      status: "sold",
      used_at: null,
    },
    {
      id: "t3",
      event_id: "e2",
      category_id: "c3",
      status: "sold",
      used_at: null,
    },
    {
      id: "t4",
      event_id: "e1",
      category_id: "c1",
      status: "refunded",
      used_at: null,
    },
    {
      id: "t5",
      event_id: "e1",
      category_id: "c1",
      status: "used",
      used_at: "2026-05-30T12:00:00Z",
    },
    {
      id: "t6",
      event_id: "e1",
      category_id: "c2",
      status: "sold",
      used_at: null,
    },
  ];
  return { events, categories, purchases, tickets };
}

describe("aggregateOrganizationAnalytics", () => {
  const r = range("7d", "2026-06-04T00:00:00Z", "2026-06-11T00:00:00Z");

  it("returns zeros for an empty organization", () => {
    const result = aggregateOrganizationAnalytics(
      { events: [], categories: [], purchases: [], tickets: [] },
      { range: r, prior: null, filters: {} },
    );
    expect(result.totals.gross_revenue).toBe(0);
    expect(result.totals.tickets_sold).toBe(0);
    expect(result.totals.sellout_rate).toBe(0);
    expect(result.totals.refund_rate).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.timeseries.length).toBeGreaterThan(0);
    expect(
      result.timeseries.every((b) => b.revenue === 0 && b.tickets === 0),
    ).toBe(true);
  });

  it("sums only paid purchases inside the range for gross revenue", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    // paid in range: 50 + 80 + 60 = 190
    expect(result.totals.gross_revenue).toBe(190);
    expect(result.totals.tickets_sold).toBe(3);
    expect(result.totals.currency).toBe("EUR");
  });

  it("computes refund rate from in-range paid + refunded", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    // 3 paid + 1 refunded → 1/4 = 0.25
    expect(result.totals.refund_rate).toBeCloseTo(0.25, 5);
  });

  it("computes sellout rate from category supply, range-independent", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    // sold: 90+20+30 = 140; supply: 150+50+100 = 300 → 140/300
    expect(result.totals.sellout_rate).toBeCloseTo(140 / 300, 5);
  });

  it("buckets time series by day for 7-day range", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    expect(result.timeseries).toHaveLength(7);
    const totalRevenue = result.timeseries.reduce(
      (acc, b) => acc + b.revenue,
      0,
    );
    expect(totalRevenue).toBe(190);
    const day5 = result.timeseries.find((b) =>
      b.bucket.startsWith("2026-06-05"),
    );
    expect(day5?.revenue).toBe(50);
  });

  it("groups paid purchases by sales channel and computes share", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    const primary = result.salesChannelBreakdown.find(
      (c) => c.channel === "mini_site",
    );
    const marketplace = result.salesChannelBreakdown.find(
      (c) => c.channel === "marketplace",
    );
    expect(primary?.revenue).toBe(130);
    expect(primary?.tickets).toBe(2);
    expect(primary?.share).toBeCloseTo(130 / 190, 5);
    expect(marketplace?.revenue).toBe(60);
    expect(marketplace?.share).toBeCloseTo(60 / 190, 5);
  });

  it("computes prior-period totals separately when prior range supplied", () => {
    const rows = makeRows();
    const priorRange = range(
      "7d",
      "2026-05-28T00:00:00Z",
      "2026-06-04T00:00:00Z",
    );
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: priorRange,
      filters: {},
    });
    // prior paid: 40
    expect(result.priorTotals?.gross_revenue).toBe(40);
    expect(result.priorTotals?.tickets_sold).toBe(1);
  });

  it("returns null priorTotals when prior range omitted", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    expect(result.priorTotals).toBeNull();
  });

  it("applies event id filter to every metric", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: { eventIds: ["e2"] },
    });
    expect(result.events.map((e) => e.event_id)).toEqual(["e2"]);
    // only e2 paid in range: 60
    expect(result.totals.gross_revenue).toBe(60);
    // e2 sellout: 30/100
    expect(result.totals.sellout_rate).toBeCloseTo(30 / 100, 5);
  });

  it("applies sales channel filter to revenue + time series + breakdown", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: { salesChannels: ["marketplace"] },
    });
    expect(result.totals.gross_revenue).toBe(60);
    expect(result.salesChannelBreakdown).toHaveLength(1);
    expect(result.salesChannelBreakdown[0].channel).toBe("marketplace");
  });

  it("populates per-event stats from the selected range", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });
    const e1 = result.events.find((e) => e.event_id === "e1");
    expect(e1).toBeDefined();
    expect(e1?.tickets_sold).toBe(2);
    expect(e1?.tickets_redeemed).toBe(1);
    expect(e1?.revenue_paid).toBe(130);
    expect(e1?.attendance_rate).toBeCloseTo(1 / 2, 5);
    expect(e1?.sellout_rate).toBeCloseTo(2 / 200, 5);
  });

  it("builds category breakdown from paid purchases inside the selected range", () => {
    const rows = makeRows();
    const result = aggregateOrganizationAnalytics(rows, {
      range: r,
      prior: null,
      filters: {},
    });

    expect(result.categoryBreakdown.map((row) => row.category_id)).toEqual([
      "c2",
      "c3",
      "c1",
    ]);
    expect(result.categoryBreakdown.map((row) => row.revenue)).toEqual([
      80, 60, 50,
    ]);
    expect(result.categoryBreakdown.map((row) => row.tickets_sold)).toEqual([
      1, 1, 1,
    ]);
  });
});

describe("rangePresetWindow", () => {
  it("derives a 7-day window ending now for the 7d preset", () => {
    const win = rangePresetWindow("7d", REF_NOW);
    expect(win.to.toISOString()).toBe(REF_NOW.toISOString());
    expect(win.from.toISOString()).toBe("2026-06-04T12:00:00.000Z");
    expect(win.preset).toBe("7d");
  });

  it("derives an all-time window starting at epoch for the all preset", () => {
    const win = rangePresetWindow("all", REF_NOW);
    expect(win.from.getTime()).toBeLessThanOrEqual(0);
    expect(win.to.toISOString()).toBe(REF_NOW.toISOString());
  });

  it("derives a YTD window starting on Jan 1 of the current year", () => {
    const win = rangePresetWindow("ytd", REF_NOW);
    expect(win.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("computePriorRange", () => {
  it("returns the immediately preceding window of the same span", () => {
    const current = range("7d", "2026-06-04T00:00:00Z", "2026-06-11T00:00:00Z");
    const prior = computePriorRange(current);
    expect(prior?.from.toISOString()).toBe("2026-05-28T00:00:00.000Z");
    expect(prior?.to.toISOString()).toBe("2026-06-04T00:00:00.000Z");
  });

  it("returns null for an all-time range (no prior window defined)", () => {
    const current = range(
      "all",
      "2000-01-01T00:00:00Z",
      "2026-06-11T00:00:00Z",
    );
    expect(computePriorRange(current)).toBeNull();
  });
});

describe("aggregateCategoryBreakdown", () => {
  function makeCategories(): AnalyticsCategoryRow[] {
    return [
      {
        id: "c1",
        event_id: "e1",
        name: "VIP",
        supply: 50,
        sold_count: 30,
        currency: "EUR",
        price: 100,
      },
      {
        id: "c2",
        event_id: "e1",
        name: "General",
        supply: 150,
        sold_count: 80,
        currency: "EUR",
        price: 20,
      },
      {
        id: "c3",
        event_id: "e2",
        name: "Early Bird",
        supply: 100,
        sold_count: 40,
        currency: "EUR",
        price: 15,
      },
    ];
  }

  it("returns empty array for empty input", () => {
    const result = aggregateCategoryBreakdown([], "EUR");
    expect(result).toEqual([]);
  });

  it("computes revenue as price * sold_count per category", () => {
    const result = aggregateCategoryBreakdown(makeCategories(), "EUR");
    const vip = result.find((r) => r.category_id === "c1");
    expect(vip?.revenue).toBe(3000); // 100 * 30
    const gen = result.find((r) => r.category_id === "c2");
    expect(gen?.revenue).toBe(1600); // 20 * 80
    const early = result.find((r) => r.category_id === "c3");
    expect(early?.revenue).toBe(600); // 15 * 40
  });

  it("sorts by revenue descending", () => {
    const result = aggregateCategoryBreakdown(makeCategories(), "EUR");
    expect(result[0].category_id).toBe("c1"); // 3000
    expect(result[1].category_id).toBe("c2"); // 1600
    expect(result[2].category_id).toBe("c3"); // 600
  });

  it("caps output at the given limit", () => {
    const result = aggregateCategoryBreakdown(makeCategories(), "EUR", 2);
    expect(result).toHaveLength(2);
    expect(result[0].category_id).toBe("c1");
  });

  it("excludes categories without an id", () => {
    const cats: AnalyticsCategoryRow[] = [
      {
        event_id: "e1",
        name: "No ID",
        supply: 100,
        sold_count: 50,
        currency: "EUR",
        price: 10,
      },
      {
        id: "c1",
        event_id: "e1",
        name: "Has ID",
        supply: 50,
        sold_count: 10,
        currency: "EUR",
        price: 20,
      },
    ];
    const result = aggregateCategoryBreakdown(cats, "EUR");
    expect(result).toHaveLength(1);
    expect(result[0].category_id).toBe("c1");
  });

  it("treats missing price as zero revenue", () => {
    const cats: AnalyticsCategoryRow[] = [
      {
        id: "c1",
        event_id: "e1",
        name: "Free",
        supply: 50,
        sold_count: 20,
        currency: "EUR",
      },
    ];
    const result = aggregateCategoryBreakdown(cats, "EUR");
    expect(result[0].revenue).toBe(0);
    expect(result[0].tickets_sold).toBe(20);
  });
});
