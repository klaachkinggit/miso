import { describe, expect, it } from "vitest";
import {
  gateAllowsTicketCategory,
  isGateSessionUsable,
} from "@/lib/gates/operations";
import {
  InviteControllerSchema,
  OpenGateSchema,
  RedeemConfirmSchema,
  RedeemPrepareSchema,
  RefundSchema,
  ResellInitSchema,
} from "@/lib/schemas";
import type { GateSession } from "@/types/db";

const eventId = "11111111-1111-4111-8111-111111111111";
const ticketId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";

function gate(overrides: Partial<GateSession>): GateSession {
  return {
    id: "gate-1",
    event_id: eventId,
    controller_user_id: "controller-1",
    short_code: "ABC12345",
    gate_name: null,
    allowed_category_ids: null,
    status: "open",
    opened_at: "2026-05-18T10:00:00Z",
    closed_at: null,
    expires_at: "2099-01-01T00:00:00Z",
    last_redemption_id: null,
    last_ticket_id: null,
    last_result: null,
    ...overrides,
  } as GateSession;
}

describe("gate policy helpers", () => {
  it("accepts only open, unexpired gate sessions", () => {
    expect(
      isGateSessionUsable(gate({ expires_at: "2099-01-01T00:00:00Z" })),
    ).toBe(true);
    expect(isGateSessionUsable(gate({ status: "closed" }))).toBe(false);
    expect(
      isGateSessionUsable(gate({ expires_at: "2000-01-01T00:00:00Z" })),
    ).toBe(false);
    expect(
      isGateSessionUsable(
        gate({ expires_at: new Date(Date.now()).toISOString() }),
      ),
    ).toBe(false);
  });

  it("treats missing or empty category scope as allow-all", () => {
    expect(
      gateAllowsTicketCategory({ allowed_category_ids: null }, categoryId),
    ).toBe(true);
    expect(
      gateAllowsTicketCategory({ allowed_category_ids: [] }, categoryId),
    ).toBe(true);
    expect(
      gateAllowsTicketCategory(
        { allowed_category_ids: [categoryId] },
        categoryId,
      ),
    ).toBe(true);
    expect(
      gateAllowsTicketCategory(
        { allowed_category_ids: [categoryId] },
        ticketId,
      ),
    ).toBe(false);
  });
});

describe("API request schemas", () => {
  it("validates gate open payload, TTL bounds, and allowed category ids", () => {
    const parsed = OpenGateSchema.parse({
      event_id: eventId,
      gate_name: "North door",
      allowed_category_ids: [categoryId],
      ttl_hours: "8",
    });

    expect(parsed.ttl_hours).toBe(8);
    expect(parsed.allowed_category_ids).toEqual([categoryId]);
    expect(
      OpenGateSchema.safeParse({ event_id: eventId, ttl_hours: 0 }).success,
    ).toBe(false);
    expect(
      OpenGateSchema.safeParse({ event_id: eventId, ttl_hours: 25 }).success,
    ).toBe(false);
    expect(
      OpenGateSchema.safeParse({
        event_id: eventId,
        allowed_category_ids: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });

  it("normalizes redeem short codes consistently for prepare and confirm", () => {
    expect(
      RedeemPrepareSchema.parse({
        gate_short_code: " ab12 ",
        ticket_id: ticketId,
      }),
    ).toMatchObject({
      gate_short_code: "AB12",
    });
    expect(
      RedeemConfirmSchema.parse({
        gate_short_code: " cd34 ",
        ticket_id: ticketId,
      }),
    ).toMatchObject({
      gate_short_code: "CD34",
    });
  });

  it("validates resale, refund, and controller invite payloads", () => {
    expect(
      ResellInitSchema.parse({ ticket_id: ticketId, price: "25" }).price,
    ).toBe(25);
    expect(
      ResellInitSchema.safeParse({ ticket_id: ticketId, price: "-1" }).success,
    ).toBe(false);
    expect(
      RefundSchema.parse({
        ticket_id: ticketId,
        reason: "Guest requested refund",
      }).reason,
    ).toBe("Guest requested refund");
    expect(
      InviteControllerSchema.parse({
        event_id: eventId,
        email: "DOOR@EXAMPLE.COM",
      }).email,
    ).toBe("DOOR@EXAMPLE.COM");
    expect(
      InviteControllerSchema.safeParse({
        event_id: eventId,
        email: "not-email",
      }).success,
    ).toBe(false);
  });
});
