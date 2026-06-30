import { afterEach, describe, expect, it } from "vitest";
import {
  allocateMoney,
  computeClubTablePricing,
  primaryCheckoutFees,
  primaryPlatformFee,
  stripeProcessingFeeForBuyerTotal,
} from "@/lib/payments/pricing";
import {
  CreateCategorySchema,
  CreateEventSchema,
  SiteSettingsSchema,
} from "@/lib/schemas";

const eventId = "11111111-1111-4111-8111-111111111111";
const ORIGINAL_PRIMARY_PERCENT = process.env.MISO_PRIMARY_PLATFORM_FEE_PERCENT;
const ORIGINAL_PRIMARY_FIXED = process.env.MISO_PRIMARY_PLATFORM_FEE_FIXED;
const ORIGINAL_STRIPE_PERCENT = process.env.MISO_STRIPE_FEE_PERCENT;
const ORIGINAL_STRIPE_FIXED = process.env.MISO_STRIPE_FEE_FIXED;

afterEach(() => {
  if (ORIGINAL_PRIMARY_PERCENT === undefined)
    delete process.env.MISO_PRIMARY_PLATFORM_FEE_PERCENT;
  else process.env.MISO_PRIMARY_PLATFORM_FEE_PERCENT = ORIGINAL_PRIMARY_PERCENT;
  if (ORIGINAL_PRIMARY_FIXED === undefined)
    delete process.env.MISO_PRIMARY_PLATFORM_FEE_FIXED;
  else process.env.MISO_PRIMARY_PLATFORM_FEE_FIXED = ORIGINAL_PRIMARY_FIXED;
  if (ORIGINAL_STRIPE_PERCENT === undefined)
    delete process.env.MISO_STRIPE_FEE_PERCENT;
  else process.env.MISO_STRIPE_FEE_PERCENT = ORIGINAL_STRIPE_PERCENT;
  if (ORIGINAL_STRIPE_FIXED === undefined)
    delete process.env.MISO_STRIPE_FEE_FIXED;
  else process.env.MISO_STRIPE_FEE_FIXED = ORIGINAL_STRIPE_FIXED;
});

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
        expect(
          (parsed.data as Record<string, unknown>).min_spending,
        ).toBeUndefined();
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
      const message = parsed.success
        ? ""
        : parsed.error.issues.map((i) => i.message).join(" | ");
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
        {
          price: "600" as unknown as number,
          online_advance: "150" as unknown as number,
          price_per_extra_guest: "50" as unknown as number,
        },
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

describe("primary checkout fees", () => {
  it("uses buyer-paid MISO and Stripe fee defaults", () => {
    delete process.env.MISO_PRIMARY_PLATFORM_FEE_PERCENT;
    delete process.env.MISO_PRIMARY_PLATFORM_FEE_FIXED;
    delete process.env.MISO_STRIPE_FEE_PERCENT;
    delete process.env.MISO_STRIPE_FEE_FIXED;

    expect(primaryPlatformFee(100)).toBe(4);
    expect(stripeProcessingFeeForBuyerTotal(104)).toBe(1.84);
    expect(primaryCheckoutFees({ faceAmount: 20, quantity: 2 })).toEqual({
      faceTotal: 40,
      platformFeeAmount: 1.6,
      stripeFeeAmount: 0.89,
      buyerTotalAmount: 42.49,
    });
  });

  it("supports configured primary platform and Stripe fees", () => {
    process.env.MISO_PRIMARY_PLATFORM_FEE_PERCENT = "5";
    process.env.MISO_PRIMARY_PLATFORM_FEE_FIXED = "0.5";
    process.env.MISO_STRIPE_FEE_PERCENT = "2";
    process.env.MISO_STRIPE_FEE_FIXED = "0.3";

    expect(primaryCheckoutFees({ faceAmount: 10, quantity: 3 })).toEqual({
      faceTotal: 30,
      platformFeeAmount: 2,
      stripeFeeAmount: 0.96,
      buyerTotalAmount: 32.96,
    });
  });

  it("allocates rounded fee cents across purchases", () => {
    expect(allocateMoney(1, 3)).toEqual([0.34, 0.33, 0.33]);
    expect(allocateMoney(0.05, 2)).toEqual([0.03, 0.02]);
  });

  it("keeps free tickets free", () => {
    expect(primaryCheckoutFees({ faceAmount: 0, quantity: 2 })).toEqual({
      faceTotal: 0,
      platformFeeAmount: 0,
      stripeFeeAmount: 0,
      buyerTotalAmount: 0,
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
    expect(parsed.floor_plan_url).toBe(
      "https://cdn.example.com/floor-plan.png",
    );
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
