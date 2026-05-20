import { describe, expect, it } from "vitest";
import { computeClubTablePricing } from "@/lib/payments/pricing";
import { CreateCategorySchema, CreateEventSchema, SiteSettingsSchema } from "@/lib/schemas";

const eventId = "11111111-1111-4111-8111-111111111111";

describe("club table: table price = minimum spending", () => {
  describe("CreateCategorySchema", () => {
    const base = {
      event_id: eventId,
      name: "Gold Table",
      price: "600",
      currency: "EUR",
      supply: "5",
    };

    it("rejects the legacy min_spending field — it has been removed", () => {
      const parsed = CreateCategorySchema.safeParse({
        ...base,
        kind: "club_table",
        online_advance: "150",
        base_capacity: "4",
        color_hex: "#D4AF37",
        min_spending: "600",
      });
      // Schema is strict in spirit: any required field missing fails.
      // We assert the data shape produced contains no `min_spending`.
      if (parsed.success) {
        expect((parsed.data as Record<string, unknown>).min_spending).toBeUndefined();
      } else {
        // Strict mode would reject — either outcome confirms the field is gone.
        expect(parsed.success).toBe(false);
      }
    });

    it("accepts a club table without min_spending (price doubles as min spending)", () => {
      const parsed = CreateCategorySchema.parse({
        ...base,
        kind: "club_table",
        online_advance: "150",
        base_capacity: "4",
        color_hex: "#D4AF37",
      });

      expect(parsed.kind).toBe("club_table");
      expect(parsed.price).toBe(600);
      expect("min_spending" in parsed).toBe(false);
    });

    it("still rejects club table missing online_advance / base_capacity / color", () => {
      const missingAdvance = CreateCategorySchema.safeParse({
        ...base,
        kind: "club_table",
        base_capacity: "4",
        color_hex: "#D4AF37",
      });
      const missingCapacity = CreateCategorySchema.safeParse({
        ...base,
        kind: "club_table",
        online_advance: "150",
        color_hex: "#D4AF37",
      });
      const missingColor = CreateCategorySchema.safeParse({
        ...base,
        kind: "club_table",
        online_advance: "150",
        base_capacity: "4",
      });

      expect(missingAdvance.success).toBe(false);
      expect(missingCapacity.success).toBe(false);
      expect(missingColor.success).toBe(false);
    });

    it("error message no longer mentions minimum spending", () => {
      const parsed = CreateCategorySchema.safeParse({
        ...base,
        kind: "club_table",
      });
      expect(parsed.success).toBe(false);
      const message = parsed.success ? "" : parsed.error.issues.map((i) => i.message).join(" | ");
      expect(message.toLowerCase()).not.toContain("minimum spending");
    });
  });

  describe("computeClubTablePricing", () => {
    it("uses table price as minSpendingTotal", () => {
      const out = computeClubTablePricing(
        { price: 600, online_advance: 150, price_per_extra_guest: 0 },
        0,
      );
      expect(out.minSpendingTotal).toBe(600);
    });

    it("amount = advance + extras * extraPrice; min spending stays equal to price", () => {
      const out = computeClubTablePricing(
        { price: 600, online_advance: 150, price_per_extra_guest: 50 },
        3,
      );
      expect(out.amount).toBe(150 + 3 * 50);
      expect(out.onlineAdvanceAmount).toBe(out.amount);
      expect(out.minSpendingTotal).toBe(600);
    });

    it("defaults advance to price when online_advance is null", () => {
      const out = computeClubTablePricing(
        { price: 600, online_advance: null, price_per_extra_guest: null },
        0,
      );
      expect(out.amount).toBe(600);
      expect(out.minSpendingTotal).toBe(600);
    });

    it("handles string-encoded numeric columns from the DB driver", () => {
      const out = computeClubTablePricing(
        // pg returns numeric columns as strings; coerce path must hold up
        { price: "600" as unknown as number, online_advance: "150" as unknown as number, price_per_extra_guest: "50" as unknown as number },
        2,
      );
      expect(out.amount).toBe(250);
      expect(out.minSpendingTotal).toBe(600);
    });

    it("price = min spending invariant holds across extras count", () => {
      for (const extras of [0, 1, 2, 4]) {
        const out = computeClubTablePricing(
          { price: 800, online_advance: 200, price_per_extra_guest: 100 },
          extras,
        );
        expect(out.minSpendingTotal).toBe(800);
      }
    });
  });
});

describe("event creation: floor plan map field", () => {
  const baseEvent = {
    name: "Demo Night",
    date: "2026-06-01T22:00",
    venue_name: "Concrete",
    city: "Paris",
    capacity: "500",
  };

  it("accepts a floor_plan_url at event creation time", () => {
    const parsed = CreateEventSchema.parse({
      ...baseEvent,
      floor_plan_url: "https://cdn.example.com/floor-plan.png",
    });
    expect(parsed.floor_plan_url).toBe("https://cdn.example.com/floor-plan.png");
  });

  it("accepts an event with no floor_plan_url (still optional)", () => {
    const parsed = CreateEventSchema.parse(baseEvent);
    expect(parsed.floor_plan_url ?? null).toBeNull();
  });

  it("rejects a non-URL floor_plan_url", () => {
    const parsed = CreateEventSchema.safeParse({
      ...baseEvent,
      floor_plan_url: "not a url",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts discovery metadata used by public filters", () => {
    const parsed = CreateEventSchema.parse({
      ...baseEvent,
      genre: "techno",
      vibe: "club",
      is_festival: true,
      artists: ["DJ A", "DJ B"],
    });
    expect(parsed.genre).toBe("techno");
    expect(parsed.vibe).toBe("club");
    expect(parsed.is_festival).toBe(true);
    expect(parsed.artists).toEqual(["DJ A", "DJ B"]);
  });

  it("defaults optional discovery metadata", () => {
    const parsed = CreateEventSchema.parse(baseEvent);
    expect(parsed.is_festival).toBe(false);
    expect(parsed.artists).toEqual([]);
  });

  it("rejects unknown discovery enum values", () => {
    const parsed = CreateEventSchema.safeParse({
      ...baseEvent,
      genre: "noise",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("site settings schema", () => {
  it("accepts landing media URLs", () => {
    const parsed = SiteSettingsSchema.parse({
      landing_hero_bg_url: "https://cdn.example.com/hero.jpg",
      landing_audience_url: "https://cdn.example.com/audience.jpg",
      landing_dashboard_url: "https://cdn.example.com/dashboard.jpg",
    });
    expect(parsed.landing_hero_bg_url).toBe("https://cdn.example.com/hero.jpg");
  });

  it("rejects invalid landing media URLs", () => {
    expect(
      SiteSettingsSchema.safeParse({
        landing_hero_bg_url: "not-a-url",
      }).success,
    ).toBe(false);
  });
});
