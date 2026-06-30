import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedEventById: vi.fn(),
}));

vi.mock("@/components/site/event-detail", () => ({
  EventDetail: () => null,
}));
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(),
  redirectIfCannotUseBuyerSurface: vi.fn(),
}));
vi.mock("@/lib/events/public", () => ({
  getPublishedEventById: mocks.getPublishedEventById,
  listPublicEventCategories: vi.fn(),
}));

import { generateMetadata } from "@/app/events/[id]/page";

describe("event metadata", () => {
  it("does not expose metadata for events hidden by public lookup rules", async () => {
    mocks.getPublishedEventById.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(mocks.getPublishedEventById).toHaveBeenCalledWith("event-1");
    expect(metadata).toEqual({
      title: "Event — MISO",
      robots: { index: false },
    });
  });

  it("does not expose metadata when the public lookup is unavailable", async () => {
    mocks.getPublishedEventById.mockRejectedValue(new Error("fetch failed"));

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(metadata).toEqual({
      title: "Event — MISO",
      robots: { index: false },
    });
  });

  it("uses public event data for share metadata", async () => {
    mocks.getPublishedEventById.mockResolvedValue({
      id: "event-1",
      name: "Night Market",
      description: "Late food and music",
      venue_name: "Warehouse",
      city: "Berlin",
      date: "2026-07-01T20:00:00.000Z",
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "event-1" }),
    });

    expect(metadata.title).toBe("Night Market — MISO");
    expect(metadata.openGraph).toMatchObject({
      title: "Night Market — MISO",
      url: expect.stringContaining("/events/event-1"),
    });
  });
});
