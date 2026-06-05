import { describe, expect, it } from "vitest";

import {
  normalizeOrganizationBranding,
  organizationBrandingJson,
} from "@/lib/organizations/branding";

describe("organization branding", () => {
  it("normalizes valid branding JSON", () => {
    expect(
      normalizeOrganizationBranding({
        tagline: "  Underground tickets  ",
        accent_color: "#33CC99",
        logo_url: "https://assets.example/logo.png",
        hero_image_url: "",
      }),
    ).toEqual({
      tagline: "Underground tickets",
      accent_color: "#33CC99",
      logo_url: "https://assets.example/logo.png",
      hero_image_url: null,
    });
  });

  it("fails closed on malformed JSON", () => {
    expect(normalizeOrganizationBranding({ accent_color: "green" })).toEqual({
      tagline: null,
      accent_color: null,
      logo_url: null,
      hero_image_url: null,
    });
  });

  it("serializes only public branding keys", () => {
    expect(
      organizationBrandingJson({
        tagline: "Tickets",
        accent_color: "#E6D8C9",
        logo_url: null,
        hero_image_url: null,
      }),
    ).toEqual({
      tagline: "Tickets",
      accent_color: "#E6D8C9",
      logo_url: null,
      hero_image_url: null,
    });
  });
});
