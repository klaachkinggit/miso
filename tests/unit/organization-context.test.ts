import { describe, expect, it } from "vitest";
import { pickActiveOrganizationId } from "@/lib/organizations/context";
import { slugifyOrganizationName } from "@/lib/organizations/setup";

describe("organization workspace context", () => {
  it("keeps a valid selected organization", () => {
    expect(
      pickActiveOrganizationId("org-2", [{ id: "org-1" }, { id: "org-2" }]),
    ).toBe("org-2");
  });

  it("falls back to the first admin organization when selection is invalid", () => {
    expect(
      pickActiveOrganizationId("not-a-member", [{ id: "org-1" }, { id: "org-2" }]),
    ).toBe("org-1");
  });

  it("returns null when the user admins no organization", () => {
    expect(pickActiveOrganizationId("org-1", [])).toBeNull();
  });

  it("does not preserve a selected organization after it is filtered out of allowed options", () => {
    expect(pickActiveOrganizationId("suspended-org", [{ id: "active-org" }])).toBe("active-org");
  });

  it("normalizes organization names into stable slugs", () => {
    expect(slugifyOrganizationName("  MISO Events Paris!  ")).toBe("miso-events-paris");
    expect(slugifyOrganizationName("Été Club")).toBe("ete-club");
    expect(slugifyOrganizationName("!!")).toBe("org");
  });
});
