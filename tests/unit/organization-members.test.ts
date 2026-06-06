import { describe, expect, it } from "vitest";
import { shouldInsertControllerMembership } from "@/lib/organizations/members";

describe("shouldInsertControllerMembership", () => {
  it("inserts only when no Organization membership exists", () => {
    expect(shouldInsertControllerMembership(null)).toBe(true);
    expect(shouldInsertControllerMembership("controller")).toBe(false);
    expect(shouldInsertControllerMembership("admin")).toBe(false);
  });
});
