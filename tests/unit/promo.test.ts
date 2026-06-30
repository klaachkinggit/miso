import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory promo_codes store + a fake supabase client covering the query
// shapes used by validateAndPricePromo / markPromoUsed. The RPC mirrors the
// SQL guard: increment only when the code is not yet exhausted.

interface PromoRow {
  id: string;
  organization_id: string;
  code: string;
  discount_kind: "percent" | "fixed";
  percent_off: number | null;
  amount_off_cents: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

const dbState = vi.hoisted(() => ({
  promos: new Map<string, PromoRow>(),
}));

// Mirrors Postgres ILIKE so the test exercises real pattern semantics: a code
// stored with `_`/`%` must only match a LITERALLY-escaped query, never a raw
// wildcard one. `\` escapes the next metacharacter (PostgREST default).
function ilikeMatches(cell: string, pattern: string): boolean {
  let regex = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\") {
      const next = pattern[++i] ?? "";
      regex += next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (ch === "%") {
      regex += ".*";
    } else if (ch === "_") {
      regex += ".";
    } else {
      regex += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${regex}$`, "i").test(cell);
}

class PromoQuery {
  private eqs: Array<{ col: string; val: unknown }> = [];
  private ilikeCol: string | null = null;
  private ilikeVal: string | null = null;

  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqs.push({ col, val });
    return this;
  }
  ilike(col: string, val: string) {
    this.ilikeCol = col;
    this.ilikeVal = val;
    return this;
  }
  private rows(): PromoRow[] {
    return [...dbState.promos.values()].filter((row) => {
      const cells = row as unknown as Record<string, unknown>;
      for (const f of this.eqs) {
        if (cells[f.col] !== f.val) return false;
      }
      if (this.ilikeCol && this.ilikeVal != null) {
        const cell = String(cells[this.ilikeCol] ?? "");
        if (!ilikeMatches(cell, this.ilikeVal)) return false;
      }
      return true;
    });
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows()[0] ?? null, error: null });
  }
}

const fakeClient = {
  from: (table: string) => {
    if (table === "promo_codes") return new PromoQuery();
    throw new Error(`unexpected table ${table}`);
  },
  rpc: (fn: string, args: { promo_id: string }) => {
    if (fn !== "increment_promo_use") throw new Error(`unexpected rpc ${fn}`);
    const row = dbState.promos.get(args.promo_id);
    if (!row) return Promise.resolve({ data: [], error: null });
    if (row.max_uses != null && row.used_count >= row.max_uses) {
      return Promise.resolve({ data: [], error: null });
    }
    row.used_count += 1;
    return Promise.resolve({ data: [{ ...row }], error: null });
  },
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fakeClient,
}));

function seedPromo(overrides: Partial<PromoRow> & { id: string }): PromoRow {
  const row: PromoRow = {
    organization_id: "org-1",
    code: "SAVE",
    discount_kind: "percent",
    percent_off: 10,
    amount_off_cents: null,
    max_uses: null,
    used_count: 0,
    starts_at: null,
    ends_at: null,
    active: true,
    ...overrides,
  };
  dbState.promos.set(row.id, row);
  return row;
}

describe("validateAndPricePromo", () => {
  beforeEach(() => {
    dbState.promos.clear();
  });

  it("prices a percent discount with floor rounding", async () => {
    seedPromo({
      id: "p1",
      code: "TEN",
      discount_kind: "percent",
      percent_off: 10,
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    const result = await validateAndPricePromo({
      code: "TEN",
      organizationId: "org-1",
      grossCents: 999,
    });
    expect(result).toEqual({ promoCodeId: "p1", discountCents: 99 });
  });

  it("matches the code case-insensitively", async () => {
    seedPromo({
      id: "p1",
      code: "EarlyBird",
      discount_kind: "percent",
      percent_off: 20,
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    const result = await validateAndPricePromo({
      code: "earlybird",
      organizationId: "org-1",
      grossCents: 5000,
    });
    expect(result.discountCents).toBe(1000);
  });

  it("prices a fixed discount capped at the gross", async () => {
    seedPromo({
      id: "p1",
      code: "FIVE",
      discount_kind: "fixed",
      percent_off: null,
      amount_off_cents: 500,
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    const result = await validateAndPricePromo({
      code: "FIVE",
      organizationId: "org-1",
      grossCents: 10000,
    });
    expect(result.discountCents).toBe(500);
  });

  it("clamps so the discount never zeros the total (gross stays >= MIN_GROSS_CENTS)", async () => {
    seedPromo({
      id: "p1",
      code: "BIG",
      discount_kind: "fixed",
      percent_off: null,
      amount_off_cents: 100000,
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    const result = await validateAndPricePromo({
      code: "BIG",
      organizationId: "org-1",
      grossCents: 5000,
    });
    // 5000 - 1 (MIN_GROSS_CENTS) leaves a 1-cent settleable gross.
    expect(result.discountCents).toBe(4999);
  });

  it("rejects when the clamped discount would leave nothing to settle", async () => {
    seedPromo({
      id: "p1",
      code: "ALL",
      discount_kind: "percent",
      percent_off: 100,
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    await expect(
      validateAndPricePromo({
        code: "ALL",
        organizationId: "org-1",
        grossCents: 1,
      }),
    ).rejects.toThrow(/cannot be applied to this amount/);
  });

  it("rejects a code before its window opens", async () => {
    seedPromo({
      id: "p1",
      code: "SOON",
      starts_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    await expect(
      validateAndPricePromo({
        code: "SOON",
        organizationId: "org-1",
        grossCents: 1000,
      }),
    ).rejects.toThrow(/not active yet/);
  });

  it("rejects an expired code", async () => {
    seedPromo({
      id: "p1",
      code: "OLD",
      ends_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const { validateAndPricePromo } = await import("@/lib/promo");
    await expect(
      validateAndPricePromo({
        code: "OLD",
        organizationId: "org-1",
        grossCents: 1000,
      }),
    ).rejects.toThrow(/expired/);
  });

  it("rejects when max_uses is exhausted", async () => {
    seedPromo({ id: "p1", code: "ONCE", max_uses: 1, used_count: 1 });
    const { validateAndPricePromo } = await import("@/lib/promo");
    await expect(
      validateAndPricePromo({
        code: "ONCE",
        organizationId: "org-1",
        grossCents: 1000,
      }),
    ).rejects.toThrow(/usage limit/);
  });

  it("rejects an inactive code", async () => {
    seedPromo({ id: "p1", code: "OFF", active: false });
    const { validateAndPricePromo } = await import("@/lib/promo");
    await expect(
      validateAndPricePromo({
        code: "OFF",
        organizationId: "org-1",
        grossCents: 1000,
      }),
    ).rejects.toThrow(/no longer active/);
  });

  it("treats LIKE metacharacters in a code as literals (no wildcard mis-resolve)", async () => {
    // `_` and `%` are LIKE wildcards. If the lookup fed raw input to ILIKE,
    // `SUMMER_20` would match `SUMMERX20` and `50%OFF` would match `50ANYOFF`.
    seedPromo({
      id: "p1",
      code: "SUMMER_20",
      discount_kind: "percent",
      percent_off: 20,
    });
    seedPromo({
      id: "p2",
      code: "SUMMERX20",
      discount_kind: "percent",
      percent_off: 90,
    });
    const { validateAndPricePromo } = await import("@/lib/promo");

    // The literal code resolves to its own row (20%), not the decoy (90%).
    const exact = await validateAndPricePromo({
      code: "SUMMER_20",
      organizationId: "org-1",
      grossCents: 10_000,
    });
    expect(exact).toEqual({ promoCodeId: "p1", discountCents: 2_000 });

    // A buyer typing the wildcard form does not slip through to a real code.
    await expect(
      validateAndPricePromo({
        code: "SUMMERX20",
        organizationId: "org-1",
        grossCents: 10_000,
      }),
    ).resolves.toEqual({ promoCodeId: "p2", discountCents: 9_000 });
  });

  it("rejects a code belonging to a different org (cross-org isolation)", async () => {
    seedPromo({ id: "p1", code: "SAVE", organization_id: "org-1" });
    const { validateAndPricePromo } = await import("@/lib/promo");
    await expect(
      validateAndPricePromo({
        code: "SAVE",
        organizationId: "org-2",
        grossCents: 1000,
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("markPromoUsed", () => {
  beforeEach(() => {
    dbState.promos.clear();
  });

  it("increments when uses remain", async () => {
    seedPromo({ id: "p1", code: "GO", max_uses: 2, used_count: 0 });
    const { markPromoUsed } = await import("@/lib/promo");
    expect(await markPromoUsed("p1")).toBe(true);
    expect(dbState.promos.get("p1")!.used_count).toBe(1);
  });

  it("refuses to increment past max_uses (atomic guard)", async () => {
    seedPromo({ id: "p1", code: "GO", max_uses: 1, used_count: 1 });
    const { markPromoUsed } = await import("@/lib/promo");
    expect(await markPromoUsed("p1")).toBe(false);
    expect(dbState.promos.get("p1")!.used_count).toBe(1);
  });

  it("always increments an uncapped code", async () => {
    seedPromo({ id: "p1", code: "GO", max_uses: null, used_count: 99 });
    const { markPromoUsed } = await import("@/lib/promo");
    expect(await markPromoUsed("p1")).toBe(true);
    expect(dbState.promos.get("p1")!.used_count).toBe(100);
  });
});
