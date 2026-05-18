import { describe, expect, it } from "vitest";
import {
  canExportTicketToPersonalWallet,
  walletExportFinalStatus,
} from "@/lib/tickets/wallet-export-policy";
import type { Ticket } from "@/types/db";

function ticket(overrides: Partial<Ticket> = {}) {
  return {
    status: "sold",
    used_at: null,
    transferred_off_platform_at: null,
    nft_contract_address: "0x0000000000000000000000000000000000000001",
    nft_token_id: 1,
    ...overrides,
  } as Pick<
    Ticket,
    | "status"
    | "used_at"
    | "transferred_off_platform_at"
    | "nft_contract_address"
    | "nft_token_id"
  >;
}

describe("wallet export policy", () => {
  const now = Date.parse("2026-05-18T12:00:00Z");
  const future = "2026-05-19T12:00:00Z";
  const past = "2026-05-17T12:00:00Z";

  it("blocks active unconsumed tickets before event date", () => {
    expect(
      canExportTicketToPersonalWallet({ ticket: ticket(), eventDate: future, nowMs: now }),
    ).toEqual({ allowed: false, reason: "not_expired_or_consumed" });
  });

  it("allows sold tickets after event date", () => {
    expect(
      canExportTicketToPersonalWallet({ ticket: ticket(), eventDate: past, nowMs: now }),
    ).toEqual({ allowed: true });
  });

  it("allows used tickets before event date", () => {
    expect(
      canExportTicketToPersonalWallet({
        ticket: ticket({ status: "used", used_at: "2026-05-18T10:00:00Z" }),
        eventDate: future,
        nowMs: now,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks tickets already exported off platform", () => {
    expect(
      canExportTicketToPersonalWallet({
        ticket: ticket({ transferred_off_platform_at: "2026-05-18T11:00:00Z" }),
        eventDate: past,
        nowMs: now,
      }),
    ).toEqual({ allowed: false, reason: "already_transferred" });
  });

  it("blocks statuses that cannot leave MISO custody", () => {
    expect(
      canExportTicketToPersonalWallet({
        ticket: ticket({ status: "listed" }),
        eventDate: past,
        nowMs: now,
      }),
    ).toEqual({ allowed: false, reason: "status:listed" });
  });

  it("blocks rows without an on-chain NFT identity", () => {
    expect(
      canExportTicketToPersonalWallet({
        ticket: ticket({ nft_contract_address: null }),
        eventDate: past,
        nowMs: now,
      }),
    ).toEqual({ allowed: false, reason: "missing_nft" });
  });

  it("preserves final post-export ticket status", () => {
    expect(walletExportFinalStatus(ticket({ status: "used" }))).toBe("used");
    expect(walletExportFinalStatus(ticket({ status: "expired" }))).toBe("expired");
    expect(walletExportFinalStatus(ticket({ status: "sold" }))).toBe("sold");
    expect(walletExportFinalStatus(ticket({ status: "sold", used_at: "2026-05-18T10:00:00Z" }))).toBe("used");
  });
});
