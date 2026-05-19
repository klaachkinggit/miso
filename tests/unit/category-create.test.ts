import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  categoryInsertPayload: null as Record<string, unknown> | null,
  ticketInsertPayload: null as Array<Record<string, unknown>> | null,
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

class TicketCategoriesQuery {
  private insertPayload: Record<string, unknown> | null = null;
  select() { return this; }
  insert(payload: Record<string, unknown>) {
    this.insertPayload = payload;
    dbState.categoryInsertPayload = payload;
    return this;
  }
  delete() { return this; }
  eq() { return this; }
  single() {
    return Promise.resolve({
      data: {
        id: "category-1",
        event_id: this.insertPayload?.event_id ?? "event-1",
        supply: this.insertPayload?.supply ?? 0,
      },
      error: null,
    });
  }
}

class TicketsQuery {
  select() { return this; }
  eq() { return this; }
  order() { return this; }
  limit() { return this; }
  maybeSingle() {
    return Promise.resolve({ data: null, error: null });
  }
  insert(payload: Array<Record<string, unknown>>) {
    dbState.ticketInsertPayload = payload;
    return Promise.resolve({ error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "ticket_categories") return new TicketCategoriesQuery();
      if (table === "tickets") return new TicketsQuery();
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("createTicketCategory", () => {
  beforeEach(() => {
    dbState.categoryInsertPayload = null;
    dbState.ticketInsertPayload = null;
  });

  it("inserts a standard category with min_spending = null", async () => {
    const { createTicketCategory } = await import("@/lib/events/setup");
    const result = await createTicketCategory({
      adminUserId: "admin-1",
      input: {
        event_id: "event-1",
        kind: "standard",
        name: "GA",
        price: 25,
        currency: "EUR",
        supply: 10,
        sales_enabled: true,
        resale_enabled: true,
        public_sales_counter_enabled: true,
      },
    });

    expect(result).toMatchObject({ id: "category-1", event_id: "event-1" });
    expect(dbState.categoryInsertPayload).toMatchObject({
      kind: "standard",
      price: 25,
      supply: 10,
      min_spending: null,
    });
    expect(dbState.ticketInsertPayload).toHaveLength(10);
  });

  it("populates min_spending from price for club_table (DB constraint)", async () => {
    const { createTicketCategory } = await import("@/lib/events/setup");
    await createTicketCategory({
      adminUserId: "admin-1",
      input: {
        event_id: "event-1",
        kind: "club_table",
        name: "Skyline Table",
        price: 600,
        currency: "EUR",
        supply: 4,
        sales_enabled: true,
        resale_enabled: true,
        public_sales_counter_enabled: true,
        online_advance: 150,
        base_capacity: 6,
        color_hex: "#FF6B35",
      },
    });
    expect(dbState.categoryInsertPayload).toMatchObject({
      kind: "club_table",
      price: 600,
      min_spending: 600,
      online_advance: 150,
      base_capacity: 6,
      color_hex: "#FF6B35",
    });
  });

  it("carries extra-guest config through to the insert payload", async () => {
    const { createTicketCategory } = await import("@/lib/events/setup");
    await createTicketCategory({
      adminUserId: "admin-1",
      input: {
        event_id: "event-1",
        kind: "club_table",
        name: "Skyline + Extras",
        price: 800,
        currency: "EUR",
        supply: 2,
        sales_enabled: true,
        resale_enabled: true,
        public_sales_counter_enabled: true,
        online_advance: 200,
        base_capacity: 4,
        extra_guests_enabled: true,
        price_per_extra_guest: 40,
        max_extra_guests: 4,
        color_hex: "#112233",
      },
    });
    expect(dbState.categoryInsertPayload).toMatchObject({
      extra_guests_enabled: true,
      price_per_extra_guest: 40,
      max_extra_guests: 4,
      min_spending: 800,
    });
  });
});
