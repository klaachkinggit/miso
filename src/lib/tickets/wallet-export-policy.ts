import type { Ticket } from "@/types/db";

const EXPORT_BLOCKED_STATUSES = new Set([
  "available",
  "reserved",
  "listed",
  "minting",
  "refund_pending",
  "refunded",
  "canceled",
  "repair_needed",
]);

export function walletExportFinalStatus(
  ticket: Pick<Ticket, "status" | "used_at">,
): "used" | "expired" | "sold" {
  if (ticket.status === "used" || ticket.used_at) return "used";
  if (ticket.status === "expired") return "expired";
  return "sold";
}

export function canExportTicketToPersonalWallet(params: {
  ticket: Pick<
    Ticket,
    | "status"
    | "used_at"
    | "transferred_off_platform_at"
    | "nft_contract_address"
    | "nft_token_id"
  >;
  eventDate: string;
  nowMs?: number;
}): { allowed: true } | { allowed: false; reason: string } {
  const { ticket } = params;
  if (ticket.transferred_off_platform_at) {
    return { allowed: false, reason: "already_transferred" };
  }
  if (EXPORT_BLOCKED_STATUSES.has(ticket.status)) {
    return { allowed: false, reason: `status:${ticket.status}` };
  }
  if (!ticket.nft_contract_address || ticket.nft_token_id === null) {
    return { allowed: false, reason: "missing_nft" };
  }

  const eventPassed = new Date(params.eventDate).getTime() < (params.nowMs ?? Date.now());
  const consumed = ticket.status === "used" || ticket.used_at !== null;
  if (!eventPassed && !consumed) {
    return { allowed: false, reason: "not_expired_or_consumed" };
  }

  return { allowed: true };
}
