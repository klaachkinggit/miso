import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory organizations + resale_price_caps stores behind a fake supabase
// client covering the query shapes used by resolveResaleCapBps:
//   from("organizations").select(...).eq("id", x).maybeSingle()
//   from("resale_price_caps").select(...).eq("country_code", x).maybeSingle()

interface OrgRow {
  id: string;
  country_code: string | null;
  resale_cap_bps: number;
}
interface CapRow {
  country_code: string;
  cap_bps: number;
}

const dbState = vi.hoisted(() => ({
  orgs: new Map<string, OrgRow>(),
  caps: new Map<string, CapRow>(),
}));

class TableQuery {
  private eqs: Array<{ col: string; val: unknown }> = [];
  constructor(private rows: () => Record<string, unknown>[]) {}
  select() {
    return this;
  }
  eq(col: string, val: unknown) {
    this.eqs.push({ col, val });
    return this;
  }
  maybeSingle() {
    const match = this.rows().find((row) =>
      this.eqs.every((f) => row[f.col] === f.val),
    );
    return Promise.resolve({ data: match ?? null, error: null });
  }
}

const fakeClient = {
  from: (table: string) => {
    if (table === "organizations") {
      return new TableQuery(() => [...dbState.orgs.values()] as unknown as Record<string, unknown>[]);
    }
    if (table === "resale_price_caps") {
      return new TableQuery(() => [...dbState.caps.values()] as unknown as Record<string, unknown>[]);
    }
    throw new Error(`unexpected table ${table}`);
  },
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fakeClient,
}));

function seedOrg(row: OrgRow) {
  dbState.orgs.set(row.id, row);
}
function seedCap(row: CapRow) {
  dbState.caps.set(row.country_code, row);
}

describe("resolveResaleCapBps", () => {
  beforeEach(() => {
    dbState.orgs.clear();
    dbState.caps.clear();
  });

  it("lets a country override beat the org default", async () => {
    seedOrg({ id: "org-1", country_code: "FR", resale_cap_bps: 2500 });
    seedCap({ country_code: "FR", cap_bps: 1000 });
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "org-1" })).toBe(1000);
  });

  it("honours a country override of 0 (face-only legal ceiling)", async () => {
    seedOrg({ id: "org-1", country_code: "BE", resale_cap_bps: 5000 });
    seedCap({ country_code: "BE", cap_bps: 0 });
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "org-1" })).toBe(0);
  });

  it("falls back to the org default when no country row exists", async () => {
    seedOrg({ id: "org-1", country_code: "DE", resale_cap_bps: 1500 });
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "org-1" })).toBe(1500);
  });

  it("falls back to the org default when the org has no country", async () => {
    seedOrg({ id: "org-1", country_code: null, resale_cap_bps: 800 });
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "org-1" })).toBe(800);
  });

  it("returns 0 when neither a country cap nor an org default applies", async () => {
    seedOrg({ id: "org-1", country_code: "DE", resale_cap_bps: 0 });
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "org-1" })).toBe(0);
  });

  it("returns 0 when the org is missing", async () => {
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "ghost" })).toBe(0);
  });
});

describe("maxResalePrice", () => {
  it("returns face value exactly when cap is 0", async () => {
    const { maxResalePrice } = await import("@/lib/resale/caps");
    expect(maxResalePrice(50, 0)).toBe(50);
    expect(maxResalePrice(33.33, 0)).toBe(33.33);
  });

  it("adds the markup for a 1000 bps (+10%) cap", async () => {
    const { maxResalePrice } = await import("@/lib/resale/caps");
    expect(maxResalePrice(50, 1000)).toBe(55);
    expect(maxResalePrice(100, 1000)).toBe(110);
  });

  it("floors to whole cents (cents-safe precision)", async () => {
    const { maxResalePrice } = await import("@/lib/resale/caps");
    // 33.33 * 1.10 = 36.663 -> floor to 36.66
    expect(maxResalePrice(33.33, 1000)).toBe(36.66);
  });
});
