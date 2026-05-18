import { describe, expect, it } from "vitest";
import {
  CreateCategorySchema,
  PurchaseInitSchema,
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
