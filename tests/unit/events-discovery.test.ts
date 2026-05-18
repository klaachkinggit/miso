import { describe, expect, it } from "vitest";
import {
  eventDiscoveryDescription,
  filterDiscoveredEvents,
  normalizeEventDiscoveryParams,
  rangeForEventFilter,
} from "@/lib/events/discovery";
import type { EventRow } from "@/types/db";

function event(overrides: Partial<EventRow>): EventRow {
  return {
    id: "event-1",
    name: "Warehouse Night",
    date: "2026-06-01T22:00:00Z",
    venue_name: "Dock 7",
    city: "Casablanca",
    capacity: 500,
    status: "published",
    organizer_user_id: "org-1",
    image_url: null,
    image_ipfs_uri: null,
    description: null,
    conditions: null,
    floor_plan_url: null,
    nft_contract_address: null,
    role_admin_address: null,
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
    ...overrides,
  } as EventRow;
}

describe("event discovery helpers", () => {
  it("normalizes filters, trims search values, and caps token length", () => {
    const parsed = normalizeEventDiscoveryParams({
      when: "not-real",
      q: `  ${"x".repeat(100)}  `,
      city: "  Casa  ",
    });

    expect(parsed.when).toBe("all");
    expect(parsed.q).toHaveLength(80);
    expect(parsed.city).toBe("Casa");
  });

  it("computes tonight range across the midnight boundary", () => {
    const lateNight = rangeForEventFilter("tonight", new Date("2026-05-18T02:30:00"));
    const evening = rangeForEventFilter("tonight", new Date("2026-05-18T20:30:00"));

    expect(lateNight?.start).toEqual(new Date("2026-05-17T18:00:00"));
    expect(lateNight?.end).toEqual(new Date("2026-05-18T06:00:00"));
    expect(evening?.start).toEqual(new Date("2026-05-18T18:00:00"));
    expect(evening?.end).toEqual(new Date("2026-05-19T06:00:00"));
  });

  it("computes weekend and next-month ranges from stable dates", () => {
    const fridayWeekend = rangeForEventFilter("weekend", new Date("2026-05-22T12:00:00"));
    const sundayWeekend = rangeForEventFilter("weekend", new Date("2026-05-24T12:00:00"));
    const nextMonth = rangeForEventFilter("next-month", new Date("2026-12-18T12:00:00"));

    expect(fridayWeekend?.start).toEqual(new Date("2026-05-23T00:00:00"));
    expect(fridayWeekend?.end).toEqual(new Date("2026-05-25T00:00:00"));
    expect(sundayWeekend?.end).toEqual(new Date("2026-05-25T00:00:00"));
    expect(nextMonth?.start).toEqual(new Date("2027-01-01T00:00:00"));
    expect(nextMonth?.end).toEqual(new Date("2027-02-01T00:00:00"));
  });

  it("filters by city and free-text event fields", () => {
    const events = [
      event({ id: "event-1", name: "Warehouse Night", city: "Casablanca" }),
      event({ id: "event-2", name: "Beach Brunch", city: "Rabat", venue_name: "Pier" }),
      event({ id: "event-3", name: "Gallery Session", city: "Casablanca", description: "Ambient room" }),
    ];

    expect(
      filterDiscoveredEvents(events, { when: "all", q: "ambient", city: "casa" }).map((e) => e.id),
    ).toEqual(["event-3"]);
    expect(
      filterDiscoveredEvents(events, { when: "all", q: "pier", city: "" }).map((e) => e.id),
    ).toEqual(["event-2"]);
  });

  it("describes active filters in buyer-facing copy", () => {
    expect(
      eventDiscoveryDescription(3, { when: "all", q: "techno", city: "Rabat" }),
    ).toBe('3 available · NFT tickets · verified access · matching "techno" · in Rabat');
  });
});
