import { describe, expect, it } from "vitest";
import {
  canManageEventWithRole,
  canOperateEventGateWithRole,
  isOrganizationControllerOnly,
  shouldUseLegacyOrganizerEventScope,
} from "@/lib/organizations/auth";
import type { EventRow, Profile } from "@/types/db";

const userProfile = (overrides: Partial<Pick<Profile, "id" | "role">> = {}) => ({
  id: "user-1",
  role: "user" as const,
  ...overrides,
});

const eventRow = (overrides: Partial<Pick<EventRow, "organization_id" | "organizer_user_id">> = {}) => ({
  organization_id: "org-1",
  organizer_user_id: "legacy-organizer",
  ...overrides,
});

describe("organization auth decisions", () => {
  it("lets organization admins manage organization-owned events", () => {
    expect(canManageEventWithRole(userProfile(), eventRow(), "admin")).toBe(true);
  });

  it("keeps transitional global admins able to manage organization-owned events", () => {
    expect(canManageEventWithRole(userProfile({ role: "admin" }), eventRow(), null)).toBe(true);
  });

  it("blocks organization controllers from managing events", () => {
    expect(canManageEventWithRole(userProfile(), eventRow(), "controller")).toBe(false);
  });

  it("keeps legacy organizer ownership only for events without organization scope", () => {
    expect(
      canManageEventWithRole(
        userProfile({ id: "legacy-organizer", role: "organizer" }),
        eventRow({ organization_id: null }),
        null,
      ),
    ).toBe(true);
    expect(
      canManageEventWithRole(
        userProfile({ id: "legacy-organizer", role: "organizer" }),
        eventRow(),
        null,
      ),
    ).toBe(false);
  });

  it("lets organization controllers operate assigned gates only", () => {
    expect(canOperateEventGateWithRole(userProfile(), eventRow(), "controller", true)).toBe(true);
    expect(canOperateEventGateWithRole(userProfile(), eventRow(), "controller", false)).toBe(false);
  });

  it("lets organization admins operate gates without assignment", () => {
    expect(canOperateEventGateWithRole(userProfile(), eventRow(), "admin", false)).toBe(true);
  });

  it("keeps transitional global admins able to operate organization gates", () => {
    expect(canOperateEventGateWithRole(userProfile({ role: "admin" }), eventRow(), null, false)).toBe(true);
  });

  it("detects controller-only organization membership for buyer-flow denial", () => {
    expect(isOrganizationControllerOnly("controller")).toBe(true);
    expect(isOrganizationControllerOnly("admin")).toBe(false);
    expect(isOrganizationControllerOnly(null)).toBe(false);
  });

  it("uses legacy organizer event scope only without Organization scope", () => {
    expect(shouldUseLegacyOrganizerEventScope(userProfile({ role: "organizer" }), false)).toBe(true);
    expect(shouldUseLegacyOrganizerEventScope(userProfile({ role: "organizer" }), true)).toBe(false);
    expect(shouldUseLegacyOrganizerEventScope(userProfile({ role: "admin" }), false)).toBe(false);
  });
});
