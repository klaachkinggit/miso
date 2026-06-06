import { describe, expect, it } from "vitest";
import {
  CreateCategorySchema,
  DeleteOrganizationSchema,
  OrganizationBrandingSchema,
  OrganizationMemberSchema,
  OrganizationRoyaltySchema,
  PurchaseInitSchema,
  RemoveOrganizationMemberSchema,
  ResaleCheckoutSchema,
  TransferOrganizationSchema,
  TransferToWalletSchema,
} from "@/lib/schemas";

const eventId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const ticketId = "33333333-3333-4333-8333-333333333333";

describe("CreateCategorySchema", () => {
  const base = {
    event_id: eventId,
    name: "VIP",
    price: "25",
    currency: "EUR",
    supply: "10",
  };

  it("accepts standard tickets with category-level toggles defaulted", () => {
    const parsed = CreateCategorySchema.parse(base);

    expect(parsed.kind).toBe("standard");
    expect(parsed.sales_enabled).toBe(true);
    expect(parsed.resale_enabled).toBe(true);
    expect(parsed.public_sales_counter_enabled).toBe(true);
  });

  it("requires Club Table financial, capacity, and color fields", () => {
    const parsed = CreateCategorySchema.safeParse({ ...base, kind: "club_table" });

    expect(parsed.success).toBe(false);
  });

  it("accepts complete Club Table config with extras", () => {
    const parsed = CreateCategorySchema.parse({
      ...base,
      kind: "club_table",
      online_advance: "150",
      base_capacity: "4",
      color_hex: "#D4AF37",
      extra_guests_enabled: true,
      price_per_extra_guest: "50",
      max_extra_guests: "2",
    });

    expect(parsed.kind).toBe("club_table");
    expect(parsed.online_advance).toBe(150);
    expect(parsed.max_extra_guests).toBe(2);
  });

  it("rejects enabled extras without price and max", () => {
    const parsed = CreateCategorySchema.safeParse({
      ...base,
      kind: "club_table",
      online_advance: "150",
      base_capacity: "4",
      color_hex: "#D4AF37",
      extra_guests_enabled: true,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("PurchaseInitSchema", () => {
  it("normalizes friend email and extras count", () => {
    const parsed = PurchaseInitSchema.parse({
      category_id: categoryId,
      extra_guests_count: "2",
      gift_recipient_email: "FRIEND@EXAMPLE.COM",
    });

    expect(parsed.extra_guests_count).toBe(2);
    expect(parsed.gift_recipient_email).toBe("friend@example.com");
  });

  it("accepts only same-site return paths", () => {
    expect(
      PurchaseInitSchema.parse({
        category_id: categoryId,
        return_path: "/s/acme/events/drop?ticket=1",
      }).return_path,
    ).toBe("/s/acme/events/drop?ticket=1");

    expect(
      PurchaseInitSchema.safeParse({
        category_id: categoryId,
        return_path: "https://evil.example",
      }).success,
    ).toBe(false);
    expect(
      PurchaseInitSchema.safeParse({
        category_id: categoryId,
        return_path: "//evil.example",
      }).success,
    ).toBe(false);
  });
});

describe("OrganizationBrandingSchema", () => {
  it("accepts public branding fields", () => {
    const parsed = OrganizationBrandingSchema.parse({
      tagline: "Tickets for the basement.",
      accent_color: "#33CC99",
      logo_url: "https://assets.example/logo.png",
      hero_image_url: "https://assets.example/hero.png",
    });

    expect(parsed.accent_color).toBe("#33CC99");
  });

  it("rejects invalid colors and image URLs", () => {
    expect(
      OrganizationBrandingSchema.safeParse({
        accent_color: "green",
      }).success,
    ).toBe(false);
    expect(
      OrganizationBrandingSchema.safeParse({
        hero_image_url: "/local-file.png",
      }).success,
    ).toBe(false);
  });
});

describe("OrganizationRoyaltySchema", () => {
  it("accepts buyer-paid royalty settings", () => {
    const parsed = OrganizationRoyaltySchema.parse({
      resale_royalty_enabled: "true",
      resale_royalty_bps: "500",
    });

    expect(parsed).toEqual({
      resale_royalty_enabled: true,
      resale_royalty_bps: 500,
    });
  });

  it("rejects royalty rates outside database bounds", () => {
    expect(
      OrganizationRoyaltySchema.safeParse({
        resale_royalty_enabled: true,
        resale_royalty_bps: 10_001,
      }).success,
    ).toBe(false);
  });
});

describe("OrganizationMemberSchema", () => {
  it("normalizes member email and role", () => {
    const parsed = OrganizationMemberSchema.parse({
      email: "TEAM@EXAMPLE.COM",
      role: "controller",
    });

    expect(parsed).toEqual({
      email: "team@example.com",
      role: "controller",
    });
  });

  it("rejects unknown organization roles", () => {
    expect(
      OrganizationMemberSchema.safeParse({
        email: "team@example.com",
        role: "owner",
      }).success,
    ).toBe(false);
  });

  it("validates member removal id", () => {
    expect(
      RemoveOrganizationMemberSchema.parse({
        membership_id: "55555555-5555-4555-8555-555555555555",
      }).membership_id,
    ).toBe("55555555-5555-4555-8555-555555555555");
  });
});

describe("Organization ownership schemas", () => {
  it("normalizes transfer recipient email", () => {
    const parsed = TransferOrganizationSchema.parse({
      email: "OWNER@EXAMPLE.COM",
    });

    expect(parsed.email).toBe("owner@example.com");
  });

  it("validates delete confirmation payload", () => {
    const parsed = DeleteOrganizationSchema.parse({
      organization_id: "66666666-6666-4666-8666-666666666666",
      confirm_name: "Boiler Room",
    });

    expect(parsed.confirm_name).toBe("Boiler Room");
    expect(
      DeleteOrganizationSchema.safeParse({
        organization_id: "bad",
        confirm_name: "Boiler Room",
      }).success,
    ).toBe(false);
  });
});

describe("ResaleCheckoutSchema", () => {
  it("validates listing checkout return path", () => {
    expect(
      ResaleCheckoutSchema.parse({
        listing_id: "44444444-4444-4444-8444-444444444444",
        return_path: "/s/acme/marketplace/44444444-4444-4444-8444-444444444444",
      }).return_path,
    ).toContain("/s/acme/marketplace/");
    expect(
      ResaleCheckoutSchema.safeParse({
        listing_id: "44444444-4444-4444-8444-444444444444",
        return_path: "/bad\\path",
      }).success,
    ).toBe(false);
  });
});

describe("TransferToWalletSchema", () => {
  it("accepts valid EVM destination address", () => {
    const parsed = TransferToWalletSchema.parse({
      ticket_id: ticketId,
      destination_address: "0x0000000000000000000000000000000000000001",
    });

    expect(parsed.destination_address).toBe("0x0000000000000000000000000000000000000001");
  });

  it("rejects invalid EVM destination address", () => {
    const parsed = TransferToWalletSchema.safeParse({
      ticket_id: ticketId,
      destination_address: "not-an-address",
    });

    expect(parsed.success).toBe(false);
  });
});
