import { describe, expect, it } from "vitest";
import {
  organizationMemberRemovalBlocker,
  shouldInsertControllerMembership,
} from "@/lib/organizations/members";

describe("shouldInsertControllerMembership", () => {
  it("inserts only when no Organization membership exists", () => {
    expect(shouldInsertControllerMembership(null)).toBe(true);
    expect(shouldInsertControllerMembership("controller")).toBe(false);
    expect(shouldInsertControllerMembership("admin")).toBe(false);
  });
});

describe("organizationMemberRemovalBlocker", () => {
  it("blocks removing the last Organization admin", () => {
    expect(
      organizationMemberRemovalBlocker({
        role: "admin",
        adminCount: 1,
      }),
    ).toBe("Organization needs at least one admin.");
  });

  it("allows removing controllers and non-last admins", () => {
    expect(
      organizationMemberRemovalBlocker({
        role: "controller",
        adminCount: 0,
      }),
    ).toBeNull();
    expect(
      organizationMemberRemovalBlocker({
        role: "admin",
        adminCount: 2,
      }),
    ).toBeNull();
  });
});
