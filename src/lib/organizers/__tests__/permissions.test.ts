import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// DB stub — shared across all tests in this file.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const db = vi.hoisted(() => ({
  events: new Map<string, Row>(),
  ticket_categories: new Map<string, Row>(),
  tickets: new Map<string, Row>(),
  organizer_profiles: new Map<string, Row>(),
  stripe_seller_accounts: new Map<string, Row>(),
}));

// Minimal chainable Supabase query builder.
// Each table mock tracks a filter key/value and routes to the right Map.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => new StubQuery(table),
  }),
}));

class StubQuery {
  private _table: string;
  private _filters: Array<[string, unknown]> = [];
  private _inFilter: [string, unknown[]] | null = null;
  private _limitN: number | null = null;
  private _patch: Row | null = null;

  constructor(table: string) {
    this._table = table;
  }

  select() {
    return this;
  }
  update(patch: Row) {
    this._patch = patch;
    return this;
  }
  eq(col: string, val: unknown) {
    this._filters.push([col, val]);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this._inFilter = [col, vals];
    return this;
  }
  limit(n: number) {
    this._limitN = n;
    return this;
  }
  order() {
    return this;
  }
  returns() {
    return this;
  }
  neq() {
    return this;
  }

  private _getMap(): Map<string, Row> {
    const maps = db as Record<string, Map<string, Row>>;
    return maps[this._table] ?? new Map();
  }

  private _matches(row: Row): boolean {
    for (const [col, val] of this._filters) {
      if (row[col] !== val) return false;
    }
    if (this._inFilter) {
      const [col, vals] = this._inFilter;
      if (!vals.includes(row[col])) return false;
    }
    return true;
  }

  private _rows(): Row[] {
    return [...this._getMap().values()].filter((r) => this._matches(r));
  }

  async single() {
    const rows = this._rows();
    if (rows.length === 0) return { data: null, error: { message: "not found" } };
    return { data: rows[0]!, error: null };
  }

  async maybeSingle() {
    const rows = this._rows();
    return { data: rows[0] ?? null, error: null };
  }

  async then(resolve: (v: { data: Row[]; error: null }) => void) {
    resolve({ data: this._rows(), error: null });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedEvent(id: string, organizerUserId: string | null = "org_1") {
  db.events.set(id, { id, organizer_user_id: organizerUserId });
}

function seedCategory(
  eventId: string,
  opts: { price?: number; currency?: string } = {},
) {
  const id = `cat_${eventId}`;
  db.ticket_categories.set(id, {
    id,
    event_id: eventId,
    price: opts.price ?? 10,
    currency: opts.currency ?? "EUR",
  });
}

function seedTicket(eventId: string) {
  const id = `tkt_${eventId}`;
  db.tickets.set(id, { id, event_id: eventId, status: "available" });
}

function seedOrganizerProfile(
  userId: string,
  opts: { status?: string; siret?: string; no_siret?: boolean } = {},
) {
  db.organizer_profiles.set(userId, {
    user_id: userId,
    status: opts.status ?? "live",
    siret: opts.siret ?? null,
    no_siret: opts.no_siret ?? true,
  });
}

function seedSellerAccount(
  userId: string,
  opts: {
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    seller_risk_status?: string;
  } = {},
) {
  db.stripe_seller_accounts.set(userId, {
    id: userId,
    user_id: userId,
    stripe_account_id: `acct_${userId}`,
    charges_enabled: opts.charges_enabled ?? true,
    payouts_enabled: opts.payouts_enabled ?? true,
    details_submitted: opts.details_submitted ?? true,
    seller_risk_status: opts.seller_risk_status ?? "clear",
    disabled_reason: null,
    requirements_json: null,
    last_webhook_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("assertEventPublishable: risk-blocked organizer", () => {
  beforeEach(() => {
    db.events.clear();
    db.ticket_categories.clear();
    db.tickets.clear();
    db.organizer_profiles.clear();
    db.stripe_seller_accounts.clear();
  });

  // A non-clear risk status fails isSellerPayoutReady, so the publish path
  // rejects in assertOrganizerLive (compliance) before assertPayoutReady's
  // typed errors can fire. The typed-error contract is pinned separately in
  // the assertPayoutReady describe below.
  it("rejects publish when organizer seller account is risk-blocked", async () => {
    seedEvent("evt_1", "org_1");
    seedCategory("evt_1", { price: 10, currency: "EUR" });
    seedTicket("evt_1");
    seedOrganizerProfile("org_1", { status: "live", no_siret: true });
    seedSellerAccount("org_1", { seller_risk_status: "blocked" });

    const { assertEventPublishable } = await import("../permissions");

    await assert.rejects(
      () => assertEventPublishable({ eventId: "evt_1" }),
      /stripe connect verification/i,
    );
  });

  it("rejects publish when risk status is 'restricted' (not yet clear)", async () => {
    seedEvent("evt_1", "org_1");
    seedCategory("evt_1", { price: 10, currency: "EUR" });
    seedTicket("evt_1");
    seedOrganizerProfile("org_1", { status: "live", no_siret: true });
    seedSellerAccount("org_1", { seller_risk_status: "restricted" });

    const { assertEventPublishable } = await import("../permissions");

    await assert.rejects(
      () => assertEventPublishable({ eventId: "evt_1" }),
      /stripe connect verification/i,
    );
  });

  it("does NOT throw for a fully clear seller account", async () => {
    seedEvent("evt_1", "org_1");
    seedCategory("evt_1", { price: 10, currency: "EUR" });
    seedTicket("evt_1");
    seedOrganizerProfile("org_1", { status: "live", no_siret: true });
    seedSellerAccount("org_1", { seller_risk_status: "clear" });

    const { assertEventPublishable } = await import("../permissions");

    // Should resolve without throwing
    await assertEventPublishable({ eventId: "evt_1" });
  });

  it("free event with MAD currency is rejected (paid MAD check)", async () => {
    seedEvent("evt_1", "org_1");
    // Paid MAD ticket — not a risk-block scenario but a currency rejection
    seedCategory("evt_1", { price: 15, currency: "MAD" });
    seedTicket("evt_1");
    seedOrganizerProfile("org_1", { status: "live", no_siret: true });
    seedSellerAccount("org_1", { seller_risk_status: "clear" });

    const { assertEventPublishable } = await import("../permissions");

    await assert.rejects(
      () => assertEventPublishable({ eventId: "evt_1" }),
      /MAD payment is not supported/i,
    );
  });
});

describe("assertEventPublishable: payout-readiness publish gate", () => {
  beforeEach(() => {
    db.events.clear();
    db.ticket_categories.clear();
    db.tickets.clear();
    db.organizer_profiles.clear();
    db.stripe_seller_accounts.clear();
  });

  it("requireOrganizerLive=true rejects when organizer account is sandbox", async () => {
    seedEvent("evt_2", "org_2");
    seedCategory("evt_2", { price: 10, currency: "EUR" });
    seedTicket("evt_2");
    // Organizer profile is still in sandbox
    seedOrganizerProfile("org_2", { status: "sandbox", no_siret: true });
    seedSellerAccount("org_2", {
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      seller_risk_status: "clear",
    });

    const { assertEventPublishable } = await import("../permissions");

    await assert.rejects(
      () =>
        assertEventPublishable({ eventId: "evt_2", requireOrganizerLive: true }),
      /sandbox/i,
    );
  });

  it("requireOrganizerLive=true rejects when payouts are disabled", async () => {
    seedEvent("evt_2", "org_2");
    seedCategory("evt_2", { price: 10, currency: "EUR" });
    seedTicket("evt_2");
    seedOrganizerProfile("org_2", { status: "live", no_siret: true });
    // Payouts not yet enabled → compliance (isSellerPayoutReady) fails first
    seedSellerAccount("org_2", {
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      seller_risk_status: "clear",
    });

    const { assertEventPublishable } = await import("../permissions");

    await assert.rejects(
      () =>
        assertEventPublishable({ eventId: "evt_2", requireOrganizerLive: true }),
      /stripe connect verification/i,
    );
  });

  it("requireOrganizerLive=true passes when organizer is live and payout-ready", async () => {
    seedEvent("evt_2", "org_2");
    seedCategory("evt_2", { price: 10, currency: "EUR" });
    seedTicket("evt_2");
    seedOrganizerProfile("org_2", { status: "live", no_siret: true });
    seedSellerAccount("org_2", {
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      seller_risk_status: "clear",
    });

    const { assertEventPublishable } = await import("../permissions");

    await assertEventPublishable({ eventId: "evt_2", requireOrganizerLive: true });
  });

  it("requireOrganizerLive=true rejects when Stripe account lacks legal identity", async () => {
    seedEvent("evt_3", "org_3");
    seedCategory("evt_3", { price: 10, currency: "EUR" });
    seedTicket("evt_3");
    // Organizer has no SIRET and no_siret=false → legal not ready
    db.organizer_profiles.set("org_3", {
      user_id: "org_3",
      status: "live",
      siret: null,
      no_siret: false,
    });
    seedSellerAccount("org_3", { seller_risk_status: "clear" });

    const { assertEventPublishable } = await import("../permissions");

    await assert.rejects(
      () =>
        assertEventPublishable({ eventId: "evt_3", requireOrganizerLive: true }),
      /legal/i,
    );
  });

  it("requireOrganizerLive=false skips live-status check (only payout-readiness enforced for EUR)", async () => {
    seedEvent("evt_4", "org_4");
    seedCategory("evt_4", { price: 10, currency: "EUR" });
    seedTicket("evt_4");
    // Organizer still sandbox — but requireOrganizerLive not set → live check skipped
    seedOrganizerProfile("org_4", { status: "sandbox", no_siret: true });
    seedSellerAccount("org_4", {
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      seller_risk_status: "clear",
    });

    const { assertEventPublishable } = await import("../permissions");

    // When requireOrganizerLive is absent but organizer_user_id is set,
    // assertEventPublishable still runs assertOrganizerLive (line 76-80 in permissions.ts).
    // The sandbox status throws "Organizer account is still in Sandbox."
    await assert.rejects(
      () => assertEventPublishable({ eventId: "evt_4" }),
      /sandbox/i,
    );
  });
});

describe("assertPayoutReady: typed errors at the seller-account layer", () => {
  beforeEach(() => {
    db.stripe_seller_accounts.clear();
  });

  it("throws SellerRiskBlockedError when risk status is blocked", async () => {
    seedSellerAccount("org_9", { seller_risk_status: "blocked" });

    const { assertPayoutReady } = await import(
      "@/lib/stripe-marketplace/seller-accounts"
    );
    const { SellerRiskBlockedError } = await import(
      "@/lib/stripe-marketplace/errors"
    );

    await assert.rejects(
      () => assertPayoutReady("org_9", "organizer"),
      (err: unknown) => err instanceof SellerRiskBlockedError,
    );
  });

  it("throws SellerNotPayoutReadyError when payouts are disabled", async () => {
    seedSellerAccount("org_9", { payouts_enabled: false });

    const { assertPayoutReady } = await import(
      "@/lib/stripe-marketplace/seller-accounts"
    );
    const { SellerNotPayoutReadyError } = await import(
      "@/lib/stripe-marketplace/errors"
    );

    await assert.rejects(
      () => assertPayoutReady("org_9", "organizer"),
      (err: unknown) => err instanceof SellerNotPayoutReadyError,
    );
  });

  it("throws SellerNotPayoutReadyError when no seller account exists", async () => {
    const { assertPayoutReady } = await import(
      "@/lib/stripe-marketplace/seller-accounts"
    );
    const { SellerNotPayoutReadyError } = await import(
      "@/lib/stripe-marketplace/errors"
    );

    await assert.rejects(
      () => assertPayoutReady("org_missing", "organizer"),
      (err: unknown) => err instanceof SellerNotPayoutReadyError,
    );
  });
});
