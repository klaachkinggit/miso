import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { pickActiveOrganizationId } from "@/lib/organizations/context";
import {
  isReservedStorefrontSlug,
  organizationStorefrontOrigin,
  storefrontPathForHost,
  storefrontRewritePath,
  storefrontRewriteUrl,
  storefrontSlugFromHost,
} from "@/lib/organizations/hosts";
import {
  normalizeStorefrontSlug,
  organizationEventPath,
  organizationMarketplaceListingPath,
  organizationMarketplacePath,
  organizationStorefrontPath,
} from "@/lib/organizations/public";
import {
  organizationSlugBaseForRequest,
  slugifyOrganizationName,
} from "@/lib/organizations/setup";

describe("organization workspace context", () => {
  it("keeps a valid selected organization", () => {
    expect(
      pickActiveOrganizationId("org-2", [{ id: "org-1" }, { id: "org-2" }]),
    ).toBe("org-2");
  });

  it("falls back to the first admin organization when selection is invalid", () => {
    expect(
      pickActiveOrganizationId("not-a-member", [
        { id: "org-1" },
        { id: "org-2" },
      ]),
    ).toBe("org-1");
  });

  it("returns null when the user admins no organization", () => {
    expect(pickActiveOrganizationId("org-1", [])).toBeNull();
  });

  it("does not preserve a selected organization after it is filtered out of allowed options", () => {
    expect(
      pickActiveOrganizationId("suspended-org", [{ id: "active-org" }]),
    ).toBe("active-org");
  });

  it("normalizes organization names into stable slugs", () => {
    expect(slugifyOrganizationName("  MISO Events Paris!  ")).toBe(
      "miso-events-paris",
    );
    expect(slugifyOrganizationName("Été Club")).toBe("ete-club");
    expect(slugifyOrganizationName("!!")).toBe("org");
  });

  it("keeps reserved platform hosts out of new organization slug bases", () => {
    expect(organizationSlugBaseForRequest("app")).toBe("app-events");
    expect(organizationSlugBaseForRequest("Shop")).toBe("shop-events");
    expect(organizationSlugBaseForRequest("Boiler Room")).toBe("boiler-room");
  });

  it("normalizes public storefront slugs and rejects unsafe path values", () => {
    expect(normalizeStorefrontSlug("  MISO-Paris  ")).toBe("miso-paris");
    expect(normalizeStorefrontSlug("-miso")).toBeNull();
    expect(normalizeStorefrontSlug("miso_legacy")).toBeNull();
  });

  it("builds organization public paths", () => {
    expect(organizationStorefrontPath("miso")).toBe("/s/miso");
    expect(organizationEventPath("miso", "midnight-drop")).toBe(
      "/s/miso/events/midnight-drop",
    );
    expect(organizationMarketplacePath("miso")).toBe("/s/miso/marketplace");
    expect(organizationMarketplaceListingPath("miso", "listing-1")).toBe(
      "/s/miso/marketplace/listing-1",
    );
  });

  it("resolves organization storefront subdomains and ignores reserved hosts", () => {
    expect(storefrontSlugFromHost("boilerroom.miso.com")).toBe("boilerroom");
    expect(storefrontSlugFromHost("boilerroom.shop.miso.com")).toBe(
      "boilerroom",
    );
    expect(storefrontSlugFromHost("app.miso.com")).toBeNull();
    expect(storefrontSlugFromHost("boilerroom.evil.com")).toBeNull();
    expect(isReservedStorefrontSlug("shop")).toBe(true);
  });

  it("rewrites clean storefront host paths to the local fallback route", () => {
    expect(storefrontRewritePath("/", "boilerroom")).toBe("/s/boilerroom");
    expect(storefrontRewritePath("/events/drop", "boilerroom")).toBe(
      "/s/boilerroom/events/drop",
    );
    expect(storefrontRewritePath("/marketplace/listing-1", "boilerroom")).toBe(
      "/s/boilerroom/marketplace/listing-1",
    );
    expect(storefrontRewritePath("/api/checkout", "boilerroom")).toBeNull();
    expect(storefrontRewritePath("/admin", "boilerroom")).toBeNull();

    const request = new NextRequest(
      "https://boilerroom.miso.com/events/drop?ticket=1",
      {
        headers: { host: "boilerroom.miso.com" },
      },
    );
    const rewrite = storefrontRewriteUrl(request);
    expect(rewrite?.pathname).toBe("/s/boilerroom/events/drop");
    expect(rewrite?.search).toBe("?ticket=1");
  });

  it("keeps links fallback-local unless already on matching storefront host", () => {
    expect(
      storefrontPathForHost(
        "boilerroom",
        "/s/boilerroom/events/drop",
        "/events/drop",
        "boilerroom.miso.com",
      ),
    ).toBe("/events/drop");
    expect(
      storefrontPathForHost(
        "boilerroom",
        "/s/boilerroom/events/drop",
        "/events/drop",
        "other.miso.com",
      ),
    ).toBe("/s/boilerroom/events/drop");
    expect(organizationStorefrontOrigin("boilerroom")).toBe(
      "https://boilerroom.miso.com",
    );
  });
});
