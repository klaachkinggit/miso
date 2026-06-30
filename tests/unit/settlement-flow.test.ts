import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  purchases: new Map<string, Record<string, unknown>>(),
  tickets: new Map<string, Record<string, unknown>>(),
  updates: [] as Array<{
    table: string;
    patch: Record<string, unknown>;
    id: string;
  }>,
}));

const mocks = vi.hoisted(() => ({
  fulfillReservedTicket: vi.fn(),
  releaseReservation: vi.fn(),
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tickets/lifecycle", () => ({
  fulfillReservedTicket: mocks.fulfillReservedTicket,
  releaseReservation: mocks.releaseReservation,
}));

vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));

vi.mock("@/lib/thirdweb/transactions", () => ({
  TransactionTimeoutError: class TransactionTimeoutError extends Error {
    name = "TransactionTimeoutError";
  },
}));

vi.mock("@/lib/chain/ops", () => {
  class ChainOpInFlightError extends Error {
    name = "ChainOpInFlightError";
  }
  class ChainOpRepairError extends Error {
    name = "ChainOpRepairError";
  }
  const NON_COMPENSATABLE = new Set([
    "TransactionTimeoutError",
    "ChainOpInFlightError",
    "ChainOpRepairError",
  ]);
  function classifyChainError(error: unknown) {
    if (
      error instanceof ChainOpRepairError ||
      (error instanceof Error && error.name === "ChainOpRepairError")
    ) {
      return { kind: "non_compensatable", state: "repair_needed" };
    }
    if (
      error instanceof ChainOpInFlightError ||
      (error instanceof Error && NON_COMPENSATABLE.has(error.name))
    ) {
      return { kind: "non_compensatable", state: "in_flight" };
    }
    return { kind: "compensatable" };
  }
  return { ChainOpInFlightError, ChainOpRepairError, classifyChainError };
});

class PurchasesQuery {
  private filterId: string | null = null;
  private updatePatch: Record<string, unknown> | null = null;
  select() {
    return this;
  }
  update(patch: Record<string, unknown>) {
    this.updatePatch = patch;
    return this;
  }
  eq(_col: string, val: string) {
    this.filterId = val;
    if (this.updatePatch && this.filterId) {
      dbState.updates.push({
        table: "purchases",
        patch: this.updatePatch,
        id: this.filterId,
      });
      const row = dbState.purchases.get(this.filterId);
      if (row) Object.assign(row, this.updatePatch);
      this.updatePatch = null;
      return Promise.resolve({ error: null });
    }
    return this;
  }
  single() {
    const row = this.filterId ? dbState.purchases.get(this.filterId) : null;
    return Promise.resolve({
      data: row ?? null,
      error: row ? null : { message: "not found" },
    });
  }
  maybeSingle() {
    const row = this.filterId ? dbState.purchases.get(this.filterId) : null;
    return Promise.resolve({ data: row ?? null, error: null });
  }
}

class TicketsQuery {
  private filterId: string | null = null;
  select() {
    return this;
  }
  eq(_col: string, val: string) {
    this.filterId = val;
    return this;
  }
  maybeSingle() {
    const row = this.filterId ? dbState.tickets.get(this.filterId) : null;
    return Promise.resolve({ data: row ?? null, error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "purchases") return new PurchasesQuery();
      if (table === "tickets") return new TicketsQuery();
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("settlePaidPurchase", () => {
  beforeEach(() => {
    dbState.purchases.clear();
    dbState.tickets.clear();
    dbState.updates.length = 0;
    mocks.fulfillReservedTicket.mockReset();
    mocks.releaseReservation.mockReset();
    mocks.audit.mockClear();
  });

  it("is idempotent when the ticket is already sold against this purchase", async () => {
    dbState.purchases.set("p1", {
      id: "p1",
      ticket_id: "t1",
      buyer_user_id: "buyer-1",
      status: "pending",
      paid_at: null,
    });
    dbState.tickets.set("t1", {
      id: "t1",
      status: "sold",
      original_purchase_id: "p1",
    });
    const { settlePaidPurchase } = await import("@/lib/payments/settlement");

    await settlePaidPurchase({ purchaseId: "p1" });

    expect(mocks.fulfillReservedTicket).not.toHaveBeenCalled();
    expect(dbState.updates).toEqual([
      expect.objectContaining({
        table: "purchases",
        patch: expect.objectContaining({ status: "paid" }),
        id: "p1",
      }),
    ]);
  });

  it("does not re-update when already paid + sold", async () => {
    dbState.purchases.set("p1", {
      id: "p1",
      ticket_id: "t1",
      buyer_user_id: "buyer-1",
      status: "paid",
      paid_at: "2026-05-01T00:00:00Z",
    });
    dbState.tickets.set("t1", {
      id: "t1",
      status: "sold",
      original_purchase_id: "p1",
    });
    const { settlePaidPurchase } = await import("@/lib/payments/settlement");

    await settlePaidPurchase({ purchaseId: "p1" });

    expect(dbState.updates).toEqual([]);
  });

  it("refuses to re-settle a refunded purchase", async () => {
    dbState.purchases.set("p1", {
      id: "p1",
      ticket_id: "t1",
      buyer_user_id: "buyer-1",
      status: "refunded",
    });
    const { settlePaidPurchase } = await import("@/lib/payments/settlement");

    await expect(settlePaidPurchase({ purchaseId: "p1" })).rejects.toThrow(
      /refunded/,
    );
    expect(mocks.fulfillReservedTicket).not.toHaveBeenCalled();
  });

  it("flips to pending and throws FulfillmentPendingError on chain-in-flight", async () => {
    dbState.purchases.set("p1", {
      id: "p1",
      ticket_id: "t1",
      buyer_user_id: "buyer-1",
      status: "pending",
    });
    dbState.tickets.set("t1", {
      id: "t1",
      status: "reserved",
      original_purchase_id: null,
    });
    const chainErr = new Error("in flight");
    chainErr.name = "ChainOpInFlightError";
    mocks.fulfillReservedTicket.mockRejectedValueOnce(chainErr);
    const { settlePaidPurchase, FulfillmentPendingError } =
      await import("@/lib/payments/settlement");

    await expect(
      settlePaidPurchase({ purchaseId: "p1" }),
    ).rejects.toBeInstanceOf(FulfillmentPendingError);
    expect(dbState.updates).toEqual([
      expect.objectContaining({
        table: "purchases",
        patch: { status: "pending" },
        id: "p1",
      }),
    ]);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "purchase.fulfillment_pending" }),
    );
  });

  it("settles failed purchase + rethrows on non-chain errors", async () => {
    dbState.purchases.set("p1", {
      id: "p1",
      ticket_id: "t1",
      buyer_user_id: "buyer-1",
      status: "pending",
    });
    dbState.tickets.set("t1", {
      id: "t1",
      status: "reserved",
      original_purchase_id: null,
    });
    mocks.fulfillReservedTicket.mockRejectedValueOnce(
      new Error("buyer email missing"),
    );
    const { settlePaidPurchase } = await import("@/lib/payments/settlement");

    await expect(settlePaidPurchase({ purchaseId: "p1" })).rejects.toThrow(
      "buyer email missing",
    );
    expect(mocks.releaseReservation).toHaveBeenCalledWith("t1");
    expect(dbState.updates.some((u) => u.patch.status === "failed")).toBe(true);
  });
});

describe("markPurchaseRefunded", () => {
  beforeEach(() => {
    dbState.purchases.clear();
    dbState.updates.length = 0;
  });

  it("updates the purchase row to refunded", async () => {
    dbState.purchases.set("p1", { id: "p1", status: "paid" });
    const { markPurchaseRefunded } = await import("@/lib/payments/settlement");

    await markPurchaseRefunded("p1");

    expect(dbState.updates).toEqual([
      { table: "purchases", patch: { status: "refunded" }, id: "p1" },
    ]);
  });
});
