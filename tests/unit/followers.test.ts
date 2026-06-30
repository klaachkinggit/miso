import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const dbState = vi.hoisted(() => ({
  followers: [] as Row[],
  profiles: new Map<string, Row>(),
  seq: 0,
  failNext: false,
}));

vi.mock("@/lib/email/send", () => ({}));

// Minimal supabase query builder over the in-memory dbState, covering only the
// operations src/lib/followers uses.
class Query {
  private table: string;
  private filters: Array<[string, unknown]> = [];
  private nullCols: string[] = [];
  private selectCols: string | null = null;
  private upsertRow: Row | null = null;
  private upsertIgnore = false;
  private updatePatch: Row | null = null;
  private isDelete = false;

  constructor(table: string) {
    this.table = table;
  }

  private rows(): Row[] {
    if (this.table === "organization_followers") return dbState.followers;
    throw new Error(`Unexpected table ${this.table}`);
  }

  upsert(row: Row, opts?: { ignoreDuplicates?: boolean }) {
    if (dbState.failNext) {
      dbState.failNext = false;
      throw new Error("db upsert blew up");
    }
    this.upsertRow = row;
    this.upsertIgnore = opts?.ignoreDuplicates ?? false;
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
  select(cols?: string) {
    this.selectCols = cols ?? "*";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  is(col: string, _val: null) {
    this.nullCols.push(col);
    return this;
  }
  returns() {
    return this;
  }

  private matches(row: Row): boolean {
    for (const [col, val] of this.filters) {
      if (row[col] !== val) return false;
    }
    for (const col of this.nullCols) {
      if (row[col] != null) return false;
    }
    return true;
  }

  private withJoins(row: Row): Row {
    if (this.selectCols?.includes("profiles(")) {
      const profile = dbState.profiles.get(row.user_id as string) ?? null;
      return { ...row, profiles: profile ? { email: profile.email } : null };
    }
    return row;
  }

  private applyUpsert(): Row | null {
    const row = this.upsertRow!;
    const existing = dbState.followers.find(
      (r) =>
        r.organization_id === row.organization_id && r.user_id === row.user_id,
    );
    if (existing) {
      if (this.upsertIgnore) return existing;
      Object.assign(existing, row);
      return existing;
    }
    const created: Row = {
      id: `f${++dbState.seq}`,
      created_at: new Date(Date.now() + dbState.seq).toISOString(),
      unsubscribed_at: null,
      unsubscribe_token: `tok-${dbState.seq}`,
      ...row,
    };
    dbState.followers.push(created);
    return created;
  }

  private applyDelete() {
    const keep = dbState.followers.filter((r) => !this.matches(r));
    dbState.followers = keep;
    return { error: null };
  }

  private applyUpdateReturning(): Row | null {
    const patch = this.updatePatch!;
    const matched = dbState.followers.filter((r) => this.matches(r));
    for (const row of matched) Object.assign(row, patch);
    return matched[0] ?? null;
  }

  single() {
    if (this.upsertRow)
      return Promise.resolve({ data: this.applyUpsert(), error: null });
    const row = this.rows().find((r) => this.matches(r));
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
    const row = this.rows().find((r) => this.matches(r));
    return Promise.resolve({ data: row ?? null, error: null });
  }

  // Awaiting the builder directly. Three shapes reach here:
  //   * a list-returning select (listActiveFollowerEmails, after .returns())
  //   * an upsert with no terminal selector (ensureAutoFollow)
  //   * a delete (unfollowOrganization)
  then(resolve: (v: { data?: Row[]; error: null }) => void) {
    if (
      this.selectCols &&
      !this.upsertRow &&
      !this.updatePatch &&
      !this.isDelete
    ) {
      const list = this.rows()
        .filter((r) => this.matches(r))
        .map((r) => this.withJoins(r));
      return resolve({ data: list, error: null });
    }
    if (this.upsertRow) {
      this.applyUpsert();
      return resolve({ error: null });
    }
    if (this.isDelete) return resolve(this.applyDelete());
    return resolve({ error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => new Query(table),
  }),
}));

beforeEach(() => {
  dbState.followers = [];
  dbState.profiles.clear();
  dbState.seq = 0;
  dbState.failNext = false;
});

describe("followOrganization", () => {
  it("is idempotent — re-following returns the same single row", async () => {
    const { followOrganization } = await import("@/lib/followers");
    const first = await followOrganization({
      organizationId: "o1",
      userId: "u1",
    });
    const second = await followOrganization({
      organizationId: "o1",
      userId: "u1",
    });

    expect(first.id).toBe(second.id);
    expect(
      dbState.followers.filter(
        (r) => r.organization_id === "o1" && r.user_id === "u1",
      ),
    ).toHaveLength(1);
  });

  it("resurrects an unsubscribed follow (clears unsubscribed_at)", async () => {
    const { followOrganization, unsubscribeByToken, isFollowing } =
      await import("@/lib/followers");
    const row = await followOrganization({
      organizationId: "o1",
      userId: "u1",
    });
    await unsubscribeByToken(row.unsubscribe_token);
    expect(await isFollowing({ organizationId: "o1", userId: "u1" })).toBe(
      false,
    );

    await followOrganization({ organizationId: "o1", userId: "u1" });
    expect(await isFollowing({ organizationId: "o1", userId: "u1" })).toBe(
      true,
    );
  });
});

describe("ensureAutoFollow", () => {
  it("inserts a follow and is a no-op on the second call", async () => {
    const { ensureAutoFollow } = await import("@/lib/followers");
    await ensureAutoFollow({ organizationId: "o1", userId: "u1" });
    await ensureAutoFollow({ organizationId: "o1", userId: "u1" });
    expect(
      dbState.followers.filter(
        (r) => r.organization_id === "o1" && r.user_id === "u1",
      ),
    ).toHaveLength(1);
  });

  it("does not resurrect an explicit unsubscribe", async () => {
    const {
      followOrganization,
      unsubscribeByToken,
      ensureAutoFollow,
      isFollowing,
    } = await import("@/lib/followers");
    const row = await followOrganization({
      organizationId: "o1",
      userId: "u1",
    });
    await unsubscribeByToken(row.unsubscribe_token);

    await ensureAutoFollow({ organizationId: "o1", userId: "u1" });
    expect(await isFollowing({ organizationId: "o1", userId: "u1" })).toBe(
      false,
    );
  });

  it("never throws when the DB call rejects", async () => {
    const { ensureAutoFollow } = await import("@/lib/followers");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    dbState.failNext = true;
    await expect(
      ensureAutoFollow({ organizationId: "o1", userId: "u1" }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("unsubscribeByToken", () => {
  it("flips unsubscribed_at and returns true once, false thereafter", async () => {
    const { followOrganization, unsubscribeByToken } =
      await import("@/lib/followers");
    const row = await followOrganization({
      organizationId: "o1",
      userId: "u1",
    });

    const first = await unsubscribeByToken(row.unsubscribe_token);
    expect(first).toBe(true);
    expect(dbState.followers[0].unsubscribed_at).not.toBeNull();

    const second = await unsubscribeByToken(row.unsubscribe_token);
    expect(second).toBe(false);
  });

  it("returns false for an unknown token", async () => {
    const { unsubscribeByToken } = await import("@/lib/followers");
    expect(await unsubscribeByToken("nope")).toBe(false);
  });
});

describe("listActiveFollowerEmails", () => {
  it("returns active followers with email and excludes unsubscribed", async () => {
    const { followOrganization, unsubscribeByToken, listActiveFollowerEmails } =
      await import("@/lib/followers");
    dbState.profiles.set("u1", { id: "u1", email: "a@example.com" });
    dbState.profiles.set("u2", { id: "u2", email: "b@example.com" });
    dbState.profiles.set("u3", { id: "u3", email: null });

    await followOrganization({ organizationId: "o1", userId: "u1" });
    const second = await followOrganization({
      organizationId: "o1",
      userId: "u2",
    });
    await followOrganization({ organizationId: "o1", userId: "u3" });
    await unsubscribeByToken(second.unsubscribe_token);

    const active = await listActiveFollowerEmails({ organizationId: "o1" });

    // u2 unsubscribed, u3 has no email → only u1.
    expect(active).toEqual([
      {
        userId: "u1",
        email: "a@example.com",
        unsubscribeToken: expect.any(String),
      },
    ]);
  });
});
