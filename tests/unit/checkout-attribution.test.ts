import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import {
  checkoutSalesChannel,
  checkoutTrackingOrigin,
  sourcePathFromReturnPath,
} from "@/lib/checkout/attribution";

function request(
  url: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, { headers });
}

describe("checkout attribution", () => {
  it("uses product-owned sales channels", () => {
    expect(checkoutSalesChannel("primary")).toBe("mini_site");
    expect(checkoutSalesChannel("resale")).toBe("marketplace");
  });

  it("extracts a bounded source path from relative return paths", () => {
    expect(sourcePathFromReturnPath("/s/miso/events/drop?ticket=1")).toBe(
      "/s/miso/events/drop",
    );
    expect(sourcePathFromReturnPath(null)).toBeNull();
  });

  it("normalizes storefront host tracking without storing the fallback prefix", () => {
    expect(
      checkoutTrackingOrigin(
        request("https://boilerroom.miso.com/api/checkout", {
          host: "boilerroom.miso.com",
        }),
        "/s/boilerroom/events/drop",
      ),
    ).toBe("host:boilerroom path:/events/drop");
  });

  it("falls back to server path for non-storefront requests", () => {
    expect(
      checkoutTrackingOrigin(
        request("https://app.miso.com/api/checkout"),
        null,
      ),
    ).toBe("path:/api/checkout");
  });
});
