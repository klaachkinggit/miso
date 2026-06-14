import { beforeEach, describe, expect, it, vi } from "vitest";

type OrgRow = {
  id: string;
  slug: string;
  status: string;
  custom_domain: string | null;
  custom_domain_verification_token: string | null;
  custom_domain_verified_at: string | null;
};

const dbState = vi.hoisted(() => ({
  orgs: [] as OrgRow[],
}));

// Minimal PostgREST-shaped builder over dbState, covering only the operations
// src/lib/organizations/custom-domain uses: update().eq(), and
// select().eq().eq().not("...","is",null).maybeSingle().
class Query {
  private filters: Array<{ kind: "eq" | "notNull"; col: string; val?: unknown }> = [];
  private selectCols: string | null = null;
  private updatePatch: Partial<OrgRow> | null = null;

  select(cols?: string) {
    this.selectCols = cols ?? "*";
    return this;
  }
  update(patch: Partial<OrgRow>) {
    this.updatePatch = patch;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  not(col: string, _op: string, _val: null) {
    this.filters.push({ kind: "notNull", col });
    return this;
  }

  private matches(row: OrgRow): boolean {
    return this.filters.every((f) => {
      const cell = (row as unknown as Record<string, unknown>)[f.col];
      return f.kind === "eq" ? cell === f.val : cell != null;
    });
  }

  private resolveUpdate() {
    const matched = dbState.orgs.filter((r) => this.matches(r));
    for (const row of matched) Object.assign(row, this.updatePatch);
    return { data: null, error: null };
  }

  maybeSingle() {
    const row = dbState.orgs.find((r) => this.matches(r));
    return Promise.resolve({ data: row ?? null, error: null });
  }

  // update().eq() is awaited directly (no terminal selector).
  then(resolve: (v: { data: null; error: null }) => void) {
    if (this.updatePatch) return resolve(this.resolveUpdate());
    return resolve({ data: null, error: null });
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => new Query(),
  }),
}));

// Simulate "DNS not reachable in this environment": resolveTxt rejects, which
// custom-domain.ts treats as null (could-not-check) → local fallback path.
vi.mock("node:dns/promises", () => ({
  resolveTxt: () => Promise.reject(new Error("ENOTFOUND")),
}));

beforeEach(() => {
  dbState.orgs = [];
  delete process.env.VERCEL;
  delete process.env.VERCEL_PROJECT_ID;
  delete process.env.VERCEL_API_TOKEN;
});

describe("normalizeCustomDomain / validateCustomDomain", () => {
  it("strips protocol, path, and port and lowercases", async () => {
    const { normalizeCustomDomain } = await import("@/lib/organizations/custom-domain");
    expect(normalizeCustomDomain("HTTPS://Tickets.Example.com/checkout")).toBe("tickets.example.com");
    expect(normalizeCustomDomain("http://shop.example.com:3000")).toBe("shop.example.com");
    expect(normalizeCustomDomain("  Example.COM  ")).toBe("example.com");
  });

  it("returns null for empty input", async () => {
    const { normalizeCustomDomain } = await import("@/lib/organizations/custom-domain");
    expect(normalizeCustomDomain("")).toBeNull();
    expect(normalizeCustomDomain(null)).toBeNull();
    expect(normalizeCustomDomain("   ")).toBeNull();
  });

  it("accepts a valid FQDN", async () => {
    const { validateCustomDomain } = await import("@/lib/organizations/custom-domain");
    expect(validateCustomDomain("tickets.example.com")).toBe("tickets.example.com");
  });

  it("rejects empty / single-label / malformed hostnames", async () => {
    const { validateCustomDomain, CustomDomainError } = await import("@/lib/organizations/custom-domain");
    expect(() => validateCustomDomain("")).toThrow(CustomDomainError);
    expect(() => validateCustomDomain("localhost")).toThrow(CustomDomainError);
    expect(() => validateCustomDomain("not a domain")).toThrow(CustomDomainError);
    expect(() => validateCustomDomain("-bad.example.com")).toThrow(CustomDomainError);
  });

  it("rejects reserved miso storefront root domains", async () => {
    const { validateCustomDomain, CustomDomainError } = await import("@/lib/organizations/custom-domain");
    expect(() => validateCustomDomain("miso.com")).toThrow(CustomDomainError);
    expect(() => validateCustomDomain("acme.miso.com")).toThrow(CustomDomainError);
  });
});

describe("resolveOrgSlugByCustomDomain", () => {
  it("returns the slug for a verified active org", async () => {
    dbState.orgs.push({
      id: "o1",
      slug: "acme",
      status: "active",
      custom_domain: "tickets.acme.com",
      custom_domain_verification_token: "tok",
      custom_domain_verified_at: new Date().toISOString(),
    });
    const { resolveOrgSlugByCustomDomain } = await import("@/lib/organizations/custom-domain");
    expect(await resolveOrgSlugByCustomDomain("tickets.acme.com")).toBe("acme");
    // normalizes the incoming host before lookup
    expect(await resolveOrgSlugByCustomDomain("https://Tickets.Acme.com/")).toBe("acme");
  });

  it("returns null for an unverified domain", async () => {
    dbState.orgs.push({
      id: "o1",
      slug: "acme",
      status: "active",
      custom_domain: "tickets.acme.com",
      custom_domain_verification_token: "tok",
      custom_domain_verified_at: null,
    });
    const { resolveOrgSlugByCustomDomain } = await import("@/lib/organizations/custom-domain");
    expect(await resolveOrgSlugByCustomDomain("tickets.acme.com")).toBeNull();
  });

  it("returns null for an unknown host", async () => {
    const { resolveOrgSlugByCustomDomain } = await import("@/lib/organizations/custom-domain");
    expect(await resolveOrgSlugByCustomDomain("nope.example.com")).toBeNull();
    expect(await resolveOrgSlugByCustomDomain(null)).toBeNull();
  });
});

describe("setOrganizationCustomDomain", () => {
  it("persists a normalized domain + token and clears verified_at", async () => {
    dbState.orgs.push({
      id: "o1",
      slug: "acme",
      status: "active",
      custom_domain: null,
      custom_domain_verification_token: null,
      custom_domain_verified_at: "2020-01-01T00:00:00Z",
    });
    const { setOrganizationCustomDomain } = await import("@/lib/organizations/custom-domain");
    const result = await setOrganizationCustomDomain({
      organizationId: "o1",
      domain: "HTTPS://Tickets.Acme.com",
    });
    expect(result.domain).toBe("tickets.acme.com");
    expect(result.token).toMatch(/[0-9a-f-]{36}/);
    expect(result.txtRecordName).toBe("_miso-verify.tickets.acme.com");
    expect(dbState.orgs[0].custom_domain).toBe("tickets.acme.com");
    expect(dbState.orgs[0].custom_domain_verified_at).toBeNull();
    expect(dbState.orgs[0].custom_domain_verification_token).toBe(result.token);
  });
});

describe("verifyOrganizationCustomDomain (local fallback)", () => {
  it("marks verified when DNS is unreachable and VERCEL is unset", async () => {
    dbState.orgs.push({
      id: "o1",
      slug: "acme",
      status: "active",
      custom_domain: "tickets.acme.com",
      custom_domain_verification_token: "tok",
      custom_domain_verified_at: null,
    });
    const { verifyOrganizationCustomDomain } = await import("@/lib/organizations/custom-domain");
    const result = await verifyOrganizationCustomDomain({ organizationId: "o1" });
    expect(result.verified).toBe(true);
    expect(dbState.orgs[0].custom_domain_verified_at).not.toBeNull();
  });

  it("refuses to mark verified on Vercel when DNS is unreachable", async () => {
    process.env.VERCEL = "1";
    dbState.orgs.push({
      id: "o1",
      slug: "acme",
      status: "active",
      custom_domain: "tickets.acme.com",
      custom_domain_verification_token: "tok",
      custom_domain_verified_at: null,
    });
    const { verifyOrganizationCustomDomain } = await import("@/lib/organizations/custom-domain");
    const result = await verifyOrganizationCustomDomain({ organizationId: "o1" });
    expect(result.verified).toBe(false);
    expect(dbState.orgs[0].custom_domain_verified_at).toBeNull();
  });

  it("throws when no domain is set", async () => {
    dbState.orgs.push({
      id: "o1",
      slug: "acme",
      status: "active",
      custom_domain: null,
      custom_domain_verification_token: null,
      custom_domain_verified_at: null,
    });
    const { verifyOrganizationCustomDomain, CustomDomainError } = await import(
      "@/lib/organizations/custom-domain"
    );
    await expect(verifyOrganizationCustomDomain({ organizationId: "o1" })).rejects.toThrow(
      CustomDomainError,
    );
  });
});

describe("addDomainToVercelProject", () => {
  it("no-ops (no fetch) when env is unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const { addDomainToVercelProject } = await import("@/lib/organizations/custom-domain");
    await addDomainToVercelProject("tickets.acme.com");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("calls the Vercel API when both env vars are set", async () => {
    process.env.VERCEL_PROJECT_ID = "prj_1";
    process.env.VERCEL_API_TOKEN = "tok_1";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const { addDomainToVercelProject } = await import("@/lib/organizations/custom-domain");
    await addDomainToVercelProject("tickets.acme.com");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/v10/projects/prj_1/domains");
    fetchSpy.mockRestore();
  });
});
