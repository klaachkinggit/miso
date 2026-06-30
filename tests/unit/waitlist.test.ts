import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const dbState = vi.hoisted(() => ({
  waitlists: [] as Row[],
  events: new Map<string, Row>(),
  organizations: new Map<string, Row>(),
  seq: 0,
}));

const mocks = vi.hoisted(() => ({
  sendWaitlistAvailable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email/send", () => ({
  sendWaitlistAvailable: mocks.sendWaitlistAvailable,
}));

vi.mock("@/lib/organizations/public", () => ({
  organizationEventPath: (org: string, slug: string) =>
    `/s/${org}/events/${slug}`,
}));

// Minimal supabase query builder over the in-memory dbState. Only the
// operations actually used by src/lib/waitlist are implemented.
class Query {
  private table: string;
  private filters: Array<[string, unknown]> = [];
  private orExpr: string | null = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private upsertRow: Row | null = null;
  private updatePatch: Row | null = null;
  private isDelete = false;

  constructor(table: string) {
    this.table = table;
  }

  private rows(): Row[] {
    if (this.table === "event_waitlists") return dbState.waitlists;
    if (this.table === "events") return [...dbState.events.values()];
    if (this.table === "organizations")
      return [...dbState.organizations.values()];
    throw new Error(`Unexpected table ${this.table}`);
  }

  upsert(row: Row) {
    this.upsertRow = row;
    return this;
  }
  update(patch: Row) {
    this.updatePatch = patch;
    return this;
  }
  delete() {
    this.isDelete = true;
    return this;
  }
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this.maybeTerminal();
  }
  or(expr: string) {
    this.orExpr = expr;
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  returns() {
    return this;
  }

  private matches(row: Row): boolean {
    for (const [col, val] of this.filters) {
      if (row[col] !== val) return false;
    }
    if (this.orExpr) {
      // Supports "notified_at.is.null,claim_expires_at.lt.<iso>".
      // Split on only the first two dots so an ISO timestamp value survives.
      const parts = this.orExpr.split(",");
      const any = parts.some((p) => {
        const firstDot = p.indexOf(".");
        const secondDot = p.indexOf(".", firstDot + 1);
        const col = p.slice(0, firstDot);
        const op = p.slice(firstDot + 1, secondDot);
        const raw = p.slice(secondDot + 1);
        if (op === "is" && raw === "null") return row[col] == null;
        if (op === "lt") return row[col] != null && String(row[col]) < raw;
        return false;
      });
      if (!any) return false;
    }
    return true;
  }

  private filtered(): Row[] {
    let out = this.rows().filter((row) => this.matches(row));
    if (this.orderCol) {
      const col = this.orderCol;
      out = [...out].sort((a, b) => {
        const av = String(a[col]);
        const bv = String(b[col]);
        return this.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  // eq() is the terminal trigger for delete (delete().eq().eq()) — but delete
  // is awaited directly, so make the builder thenable when a delete is queued.
  private maybeTerminal() {
    return this;
  }

  private applyDelete() {
    const keep = dbState.waitlists.filter((row) => !this.matches(row));
    const removed = dbState.waitlists.length - keep.length;
    dbState.waitlists = keep;
    return { error: null, count: removed };
  }

  private applyUpsert() {
    const row = this.upsertRow!;
    const existing = dbState.waitlists.find(
      (r) => r.event_id === row.event_id && r.user_id === row.user_id,
    );
    if (existing) {
      Object.assign(existing, row);
      return existing;
    }
    const created: Row = {
      id: `w${++dbState.seq}`,
      created_at: new Date(Date.now() + dbState.seq).toISOString(),
      notified_at: null,
      claim_expires_at: null,
      ...row,
    };
    dbState.waitlists.push(created);
    return created;
  }

  private applyUpdate() {
    const patch = this.updatePatch!;
    for (const row of dbState.waitlists.filter((r) => this.matches(r))) {
      Object.assign(row, patch);
    }
    return { error: null };
  }

  // Atomic update-and-return: apply the patch to matching rows at apply time
  // and return the (single) updated row, or null if the predicate matched
  // nothing. Models the compare-and-swap claim in notifyWaitlistHead.
  private applyUpdateReturning() {
    const patch = this.updatePatch!;
    const matched = dbState.waitlists.filter((r) => this.matches(r));
    for (const row of matched) Object.assign(row, patch);
    return matched[0] ?? null;
  }

  single() {
    if (this.upsertRow)
      return Promise.resolve({ data: this.applyUpsert(), error: null });
    const [row] = this.filtered();
    return Promise.resolve({
      data: row ?? null,
      error: row ? null : { message: "not found" },
    });
  }
  maybeSingle() {
    if (this.upsertRow)
      return Promise.resolve({ data: this.applyUpsert(), error: null });
    if (this.updatePatch)
      return Promise.resolve({
        data: this.applyUpdateReturning(),
        error: null,
      });
    const [row] = this.filtered();
    return Promise.resolve({ data: row ?? null, error: null });
  }

  // Awaiting the builder directly (delete/update with no .single()).
  then(resolve: (v: { error: null }) => void) {
    if (this.isDelete) return resolve(this.applyDelete());
    if (this.updatePatch) return resolve(this.applyUpdate());
    return resolve({ error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => new Query(table),
  }),
}));

describe("joinWaitlist", () => {
  beforeEach(() => {
    dbState.waitlists = [];
    dbState.seq = 0;
    mocks.sendWaitlistAvailable.mockClear();
  });

  it("is idempotent — re-joining returns the same single row", async () => {
    const { joinWaitlist } = await import("@/lib/waitlist");

    const first = await joinWaitlist({ eventId: "e1", userId: "u1" });
    const second = await joinWaitlist({ eventId: "e1", userId: "u1" });

    expect(first.id).toBe(second.id);
    expect(
      dbState.waitlists.filter(
        (r) => r.event_id === "e1" && r.user_id === "u1",
      ),
    ).toHaveLength(1);
  });
});

describe("notifyWaitlistHead", () => {
  beforeEach(() => {
    dbState.waitlists = [];
    dbState.events.clear();
    dbState.organizations.clear();
    dbState.seq = 0;
    mocks.sendWaitlistAvailable.mockClear();
    dbState.events.set("e1", {
      id: "e1",
      name: "Sold Out Show",
      slug: "sold-out",
      organization_id: "o1",
    });
    dbState.organizations.set("o1", { id: "o1", slug: "club" });
  });

  it("picks the oldest un-notified entry, stamps fields, and emails it", async () => {
    const { joinWaitlist, notifyWaitlistHead } = await import("@/lib/waitlist");
    await joinWaitlist({ eventId: "e1", userId: "first" });
    await joinWaitlist({ eventId: "e1", userId: "second" });

    const notified = await notifyWaitlistHead({ eventId: "e1" });

    expect(notified).toBe(true);
    const head = dbState.waitlists.find((r) => r.user_id === "first")!;
    expect(head.notified_at).not.toBeNull();
    expect(head.claim_expires_at).not.toBeNull();
    expect(new Date(head.claim_expires_at as string).getTime()).toBeGreaterThan(
      new Date(head.notified_at as string).getTime(),
    );
    expect(
      dbState.waitlists.find((r) => r.user_id === "second")!.notified_at,
    ).toBeNull();
    expect(mocks.sendWaitlistAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "first", eventName: "Sold Out Show" }),
    );
  });

  it("notifies exactly one head under two concurrent callers", async () => {
    const { joinWaitlist, notifyWaitlistHead } = await import("@/lib/waitlist");
    await joinWaitlist({ eventId: "e1", userId: "first" });
    await joinWaitlist({ eventId: "e1", userId: "second" });

    const [a, b] = await Promise.all([
      notifyWaitlistHead({ eventId: "e1" }),
      notifyWaitlistHead({ eventId: "e1" }),
    ]);

    // Both succeed, but each claims a DIFFERENT head — the second caller is
    // pushed to the next eligible entry by the compare-and-swap, never the
    // same one twice.
    expect([a, b]).toEqual([true, true]);
    const notified = dbState.waitlists.filter((r) => r.notified_at != null);
    expect(notified).toHaveLength(2);
    const targets = mocks.sendWaitlistAvailable.mock.calls.map(
      (c) => (c[0] as { userId: string }).userId,
    );
    expect(new Set(targets)).toEqual(new Set(["first", "second"]));
  });

  it("does not double-notify the same head when only one entry is eligible", async () => {
    const { joinWaitlist, notifyWaitlistHead } = await import("@/lib/waitlist");
    await joinWaitlist({ eventId: "e1", userId: "only" });

    const [a, b] = await Promise.all([
      notifyWaitlistHead({ eventId: "e1" }),
      notifyWaitlistHead({ eventId: "e1" }),
    ]);

    // One caller wins the claim; the other finds no eligible entry and returns
    // false. The single head is emailed exactly once.
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(mocks.sendWaitlistAvailable).toHaveBeenCalledTimes(1);
    expect(mocks.sendWaitlistAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "only" }),
    );
  });

  it("is a no-op on an empty queue and never throws", async () => {
    const { notifyWaitlistHead } = await import("@/lib/waitlist");

    const notified = await notifyWaitlistHead({ eventId: "e1" });

    expect(notified).toBe(false);
    expect(mocks.sendWaitlistAvailable).not.toHaveBeenCalled();
  });

  it("never throws even if a DB call rejects", async () => {
    const { notifyWaitlistHead } = await import("@/lib/waitlist");
    mocks.sendWaitlistAvailable.mockRejectedValueOnce(new Error("smtp down"));
    dbState.waitlists.push({
      id: "w1",
      event_id: "e1",
      user_id: "u1",
      created_at: new Date().toISOString(),
      notified_at: null,
      claim_expires_at: null,
    });

    await expect(notifyWaitlistHead({ eventId: "e1" })).resolves.toBe(false);
  });
});
