import crypto from "node:crypto";
import { vi } from "vitest";

// In-memory Supabase + Stripe fakes for the multi-item marketplace flow.
// Covers only the query shapes exercised by createPrimaryCheckout,
// settleSucceededPaymentIntent, the state machine, and the items helpers.

type Row = Record<string, unknown>;

interface FilterEq {
  col: string;
  val: unknown;
}

function matches(
  row: Row,
  eqs: FilterEq[],
  neqs: FilterEq[],
  ins: FilterEq[],
): boolean {
  for (const f of eqs) if (row[f.col] !== f.val) return false;
  for (const f of neqs) if (row[f.col] === f.val) return false;
  for (const f of ins) {
    if (!Array.isArray(f.val) || !f.val.includes(row[f.col])) return false;
  }
  return true;
}

class TableQuery {
  private eqs: FilterEq[] = [];
  private neqs: FilterEq[] = [];
  private ins: FilterEq[] = [];
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | null = null;
  private payload: Row | Row[] | null = null;
  private selectArg = "";

  constructor(
    private readonly store: Map<string, Row>,
    private readonly table: string,
  ) {}

  select(arg = "") {
    if (this.mode === null) this.mode = "select";
    this.selectArg = arg;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqs.push({ col, val });
    return this;
  }
  neq(col: string, val: unknown) {
    this.neqs.push({ col, val });
    return this;
  }
  in(col: string, val: unknown[]) {
    this.ins.push({ col, val });
    return this;
  }
  or() {
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  returns() {
    return this.resolveList();
  }

  private rows(): Row[] {
    return [...this.store.values()].filter((r) =>
      matches(r, this.eqs, this.neqs, this.ins),
    );
  }

  private applyJoins(row: Row): Row {
    // Supports the join used by loadPrimaryItemPurchases:
    //   select("purchase_id, purchases(id, ticket_id, buyer_user_id, status)")
    if (this.selectArg.includes("purchases(")) {
      const purchases = fakeDb.purchases.get(row.purchase_id as string) ?? null;
      return {
        purchase_id: row.purchase_id,
        purchases: purchases
          ? {
              id: purchases.id,
              ticket_id: purchases.ticket_id,
              buyer_user_id: purchases.buyer_user_id,
              status: purchases.status,
            }
          : null,
      };
    }
    return row;
  }

  private commitInsert(): Row[] {
    const list = Array.isArray(this.payload)
      ? this.payload
      : [this.payload as Row];
    const created: Row[] = [];
    for (const input of list) {
      const row: Row = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...input,
      };
      this.store.set(row.id as string, row);
      created.push(row);
    }
    return created;
  }

  private commitUpdate(): Row[] {
    const updated: Row[] = [];
    for (const row of this.rows()) {
      Object.assign(row, this.payload);
      updated.push(row);
    }
    return updated;
  }

  private resolveRows(): { rows: Row[]; error: unknown } {
    if (this.mode === "insert")
      return { rows: this.commitInsert(), error: null };
    if (this.mode === "update")
      return { rows: this.commitUpdate(), error: null };
    let rows = this.rows();
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return { rows: rows.map((r) => this.applyJoins(r)), error: null };
  }

  private resolveList() {
    const { rows, error } = this.resolveRows();
    return Promise.resolve({ data: rows, error });
  }

  single() {
    const { rows, error } = this.resolveRows();
    if (error) return Promise.resolve({ data: null, error });
    if (rows.length === 0) {
      return Promise.resolve({ data: null, error: { message: "not found" } });
    }
    return Promise.resolve({ data: rows[0], error: null });
  }
  maybeSingle() {
    const { rows, error } = this.resolveRows();
    return Promise.resolve({ data: rows[0] ?? null, error });
  }
  // Bare insert/update with no select() is awaited directly.
  then(onFulfilled: (v: { data: Row[]; error: unknown }) => unknown) {
    const { rows, error } = this.resolveRows();
    return Promise.resolve({ data: rows, error }).then(onFulfilled);
  }
}

class FakeDb {
  purchases = new Map<string, Row>();
  payments = new Map<string, Row>();
  items = new Map<string, Row>();
  tickets = new Map<string, Row>();
  events = new Map<string, Row>();
  transfers = new Map<string, Row>();
  category: Row = {};
  private serial = 0;

  reset() {
    this.purchases.clear();
    this.payments.clear();
    this.items.clear();
    this.tickets.clear();
    this.events.clear();
    this.transfers.clear();
    this.category = {};
    this.serial = 0;
  }

  seedEvent(opts: { price: number }) {
    this.events.set("event-1", {
      id: "event-1",
      organizer_user_id: "org-1",
      name: "Test Event",
    });
    this.category = {
      id: "cat-1",
      currency: "EUR",
      price: opts.price,
      kind: "general",
      name: "GA",
    };
  }

  seedTickets(n: number) {
    for (let i = 0; i < n; i++) {
      const id = `ticket-${i + 1}`;
      this.tickets.set(id, {
        id,
        event_id: "event-1",
        category_id: "cat-1",
        status: "available",
        owner_user_id: null,
        serial_number: i + 1,
      });
    }
  }

  reserveNextTicket(buyerUserId: string): Row {
    const free = [...this.tickets.values()].find(
      (t) => t.status === "available",
    );
    const ticket =
      free ??
      (() => {
        const id = `ticket-${++this.serial}`;
        const t: Row = {
          id,
          event_id: "event-1",
          category_id: "cat-1",
          status: "available",
          owner_user_id: null,
          serial_number: this.serial,
        };
        this.tickets.set(id, t);
        return t;
      })();
    ticket.status = "reserved";
    ticket.owner_user_id = buyerUserId;
    return { ...ticket };
  }

  releaseTicket(id: string) {
    const t = this.tickets.get(id);
    if (t && t.status === "reserved") {
      t.status = "available";
      t.owner_user_id = null;
      t.reserved_until = null;
    }
  }

  table(name: string): Map<string, Row> {
    switch (name) {
      case "purchases":
        return this.purchases;
      case "marketplace_payments":
        return this.payments;
      case "marketplace_payment_items":
        return this.items;
      case "tickets":
        return this.tickets;
      case "events":
        return this.events;
      case "marketplace_transfers":
        return this.transfers;
      default:
        throw new Error(`fake-db: unexpected table ${name}`);
    }
  }
}

export const fakeDb = new FakeDb();

export function resetFakeDb() {
  fakeDb.reset();
}

export function createFakeServiceClient() {
  return {
    from: (table: string) => new TableQuery(fakeDb.table(table), table),
  };
}

interface FakeIntent {
  id: string;
  amount: number;
  client_secret: string;
  metadata: Record<string, string | undefined>;
}

class FakeStripe {
  intents: FakeIntent[] = [];
  failNextIntent = false;
  private counter = 0;

  reset() {
    this.intents = [];
    this.failNextIntent = false;
    this.counter = 0;
  }

  paymentIntents = {
    create: vi.fn(
      async (params: { amount: number; metadata: Record<string, string> }) => {
        if (this.failNextIntent) {
          this.failNextIntent = false;
          throw new Error("stripe intent create failed");
        }
        const intent: FakeIntent = {
          id: `pi_${++this.counter}`,
          amount: params.amount,
          client_secret: `cs_${this.counter}`,
          metadata: params.metadata,
        };
        this.intents.push(intent);
        return intent;
      },
    ),
    retrieve: vi.fn(async (id: string) => {
      const found = this.intents.find((i) => i.id === id);
      return found ?? { id, client_secret: `cs_${id}` };
    }),
  };
}

export const fakeStripe = new FakeStripe();
