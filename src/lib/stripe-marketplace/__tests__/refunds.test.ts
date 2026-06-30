import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import type Stripe from "stripe";

import type { MarketplacePaymentRow } from "../payments";
import type { MarketplaceTransferRow } from "../transfers";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  markPurchaseRefunded: vi.fn(),
  markTicketRefunded: vi.fn(),
  reverseTransfer: vi.fn(),
  sendRefundNotice: vi.fn(),
  stripeRefundCreate: vi.fn(),
  transitionPayment: vi.fn(),
  upsertSellerAccount: vi.fn(),
  listTransfersForPayment: vi.fn(),
  purchaseItems: [
    { purchases: { id: "purchase-1", ticket_id: "ticket-1", status: "paid" } },
    { purchases: { id: "purchase-2", ticket_id: "ticket-2", status: "paid" } },
  ],
  tickets: new Map([
    ["ticket-1", { id: "ticket-1", status: "sold" }],
    ["ticket-2", { id: "ticket-2", status: "sold" }],
  ]),
}));

class FakeQuery {
  private filters = new Map<string, unknown>();

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  in() {
    return this;
  }

  update() {
    return this;
  }

  returns() {
    if (this.table === "marketplace_payment_items") {
      return Promise.resolve({ data: mocks.purchaseItems, error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  maybeSingle() {
    if (this.table === "tickets") {
      const ticketId = this.filters.get("id") as string;
      return Promise.resolve({
        data: mocks.tickets.get(ticketId) ?? null,
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }
}

vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/email/send", () => ({
  sendRefundNotice: mocks.sendRefundNotice,
}));
vi.mock("@/lib/payments/settlement", () => ({
  markPurchaseRefunded: mocks.markPurchaseRefunded,
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => new FakeQuery(table),
  }),
}));
vi.mock("@/lib/tickets/lifecycle", () => ({
  markTicketRefunded: mocks.markTicketRefunded,
}));
vi.mock("../seller-accounts", () => ({
  upsertSellerAccount: mocks.upsertSellerAccount,
}));
vi.mock("../client", () => ({
  stripeClient: () => ({
    refunds: { create: mocks.stripeRefundCreate },
  }),
}));
vi.mock("../state-machine", () => ({
  transitionPayment: mocks.transitionPayment,
}));
vi.mock("../transfers", () => ({
  listTransfersForPayment: mocks.listTransfersForPayment,
  reverseTransfer: mocks.reverseTransfer,
}));

import { manuallyRefundPayment, recordExternalChargeRefund } from "../refunds";

function payment(): MarketplacePaymentRow {
  return {
    id: "payment-1",
    kind: "primary",
    buyer_user_id: "buyer-1",
    primary_seller_user_id: "seller-1",
    organizer_user_id: null,
    purchase_id: null,
    resale_listing_id: null,
    amount_total_cents: 1000,
    currency: "EUR",
    marketplace_fee_bps: 3000,
    marketplace_fee_cents: 300,
    organizer_royalty_bps: 0,
    organizer_royalty_cents: 0,
    primary_seller_cents: 700,
    promo_code_id: null,
    discount_cents: 0,
    stripe_payment_intent_id: "pi_1",
    stripe_charge_id: "ch_1",
    stripe_transfer_group: "group_1",
    status: "paid",
    failure_reason: null,
    succeeded_at: null,
    fulfilled_at: null,
    transferred_at: null,
    refunded_at: null,
    disputed_at: null,
    last_webhook_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

function transfer(): MarketplaceTransferRow {
  return {
    id: "transfer-1",
    marketplace_payment_id: "payment-1",
    recipient_user_id: "seller-1",
    recipient_role: "organizer",
    amount_cents: 700,
    currency: "EUR",
    stripe_connected_account_id: "acct_1",
    stripe_transfer_id: "tr_1",
    stripe_transfer_reversal_id: "trr_old",
    stripe_transfer_reversal_ids: ["trr_old"],
    reversed_amount_cents: 400,
    status: "created",
    failure_reason: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

describe("recordExternalChargeRefund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTransfersForPayment.mockResolvedValue([transfer()]);
    mocks.reverseTransfer.mockResolvedValue("trr_new");
    mocks.stripeRefundCreate.mockResolvedValue({ id: "re_1", amount: 700 });
  });

  it("uses cumulative refund target and finalizes all linked primary rows", async () => {
    await recordExternalChargeRefund({
      payment: payment(),
      refund: { id: "re_2", amount: 300 } as Stripe.Refund,
      cumulativeRefundedCents: 700,
    });

    assert.equal(mocks.reverseTransfer.mock.calls.length, 1);
    assert.deepEqual(mocks.reverseTransfer.mock.calls[0][0], {
      marketplaceTransferId: "transfer-1",
      stripeTransferId: "tr_1",
      amountCents: 300,
      refundKey: "re_2",
    });
    assert.deepEqual(
      mocks.markPurchaseRefunded.mock.calls.map((call) => call[0]),
      ["purchase-1", "purchase-2"],
    );
    assert.deepEqual(
      mocks.markTicketRefunded.mock.calls.map((call) => call[0]),
      ["ticket-1", "ticket-2"],
    );
    assert.deepEqual(mocks.transitionPayment.mock.calls.at(-1), [
      "payment-1",
      { type: "REFUNDED" },
    ]);
  });
});

describe("manuallyRefundPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTransfersForPayment.mockResolvedValue([transfer()]);
    mocks.reverseTransfer.mockResolvedValue("trr_new");
    mocks.stripeRefundCreate.mockResolvedValue({
      id: "re_manual",
      amount: 700,
    });
  });

  it("does not reverse seller transfers when Stripe refund creation fails", async () => {
    mocks.stripeRefundCreate.mockRejectedValue(
      new Error("stripe refused refund"),
    );

    await assert.rejects(
      manuallyRefundPayment({ payment: payment() }),
      /stripe refused refund/,
    );

    assert.equal(mocks.reverseTransfer.mock.calls.length, 0);
    assert.deepEqual(mocks.stripeRefundCreate.mock.calls[0], [
      {
        charge: "ch_1",
        amount: 700,
        reverse_transfer: false,
        refund_application_fee: false,
        metadata: { marketplace_payment_id: "payment-1" },
      },
      { idempotencyKey: "refund_payment-1_700" },
    ]);
  });

  it("creates the Stripe refund before reversing seller transfers", async () => {
    const order: string[] = [];
    mocks.stripeRefundCreate.mockImplementation(async () => {
      order.push("refund");
      return { id: "re_manual", amount: 700 };
    });
    mocks.reverseTransfer.mockImplementation(async () => {
      order.push("reverse");
      return "trr_new";
    });

    await manuallyRefundPayment({ payment: payment() });

    assert.deepEqual(order, ["refund", "reverse"]);
  });
});
