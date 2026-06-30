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
      return new TableQuery(
        () =>
          [...dbState.orgs.values()] as unknown as Record<string, unknown>[],
      );
    }
    if (table === "resale_price_caps") {
      return new TableQuery(
        () =>
          [...dbState.caps.values()] as unknown as Record<string, unknown>[],
      );
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

  it.each([
    {
      name: "lets a country override beat the org default",
      org: { id: "org-1", country_code: "FR", resale_cap_bps: 2500 },
      cap: { country_code: "FR", cap_bps: 1000 },
      expected: 1000,
    },
    {
      name: "honours a country override of 0 (face-only legal ceiling)",
      org: { id: "org-1", country_code: "BE", resale_cap_bps: 5000 },
      cap: { country_code: "BE", cap_bps: 0 },
      expected: 0,
    },
    {
      name: "falls back to the org default when no country row exists",
      org: { id: "org-1", country_code: "DE", resale_cap_bps: 1500 },
      expected: 1500,
    },
    {
      name: "falls back to the org default when the org has no country",
      org: { id: "org-1", country_code: null, resale_cap_bps: 800 },
      expected: 800,
    },
    {
      name: "returns 0 when neither a country cap nor an org default applies",
      org: { id: "org-1", country_code: "DE", resale_cap_bps: 0 },
      expected: 0,
    },
  ])("$name", async ({ org, cap, expected }) => {
    seedOrg(org);
    if (cap) seedCap(cap);
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: org.id })).toBe(
      expected,
    );
  });

  it("returns 0 when the org is missing", async () => {
    const { resolveResaleCapBps } = await import("@/lib/resale/caps");
    expect(await resolveResaleCapBps({ organizationId: "ghost" })).toBe(0);
  });
});

describe("maxResalePrice", () => {
  it.each([
    [50, 0, 50],
    [33.33, 0, 33.33],
    [50, 1000, 55],
    [100, 1000, 110],
    [33.33, 1000, 36.66],
  ])("caps %s with %s bps at %s", async (price, capBps, expected) => {
    const { maxResalePrice } = await import("@/lib/resale/caps");
    expect(maxResalePrice(price, capBps)).toBe(expected);
  });
});
