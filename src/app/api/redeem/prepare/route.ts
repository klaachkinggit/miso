// POST /api/redeem/prepare — customer-side: build the demo redeem payload
// that proves Ticket ownership for the Gate.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { RedeemPrepareSchema } from "@/lib/schemas";
import { prepareRedemption } from "@/lib/verification/redeem";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await parseJsonBody(request, RedeemPrepareSchema, "Invalid redeem payload.");
    const { prepared, gate, ticket } = await prepareRedemption({
      userId: user.id,
      gateShortCode: body.gate_short_code,
      ticketId: body.ticket_id,
    });
    return NextResponse.json({
      prepared,
      gate: { id: gate.id, short_code: gate.short_code, gate_name: gate.gate_name, event_id: gate.event_id },
      ticket: { id: ticket.id, serial_number: ticket.serial_number },
    });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Could not prepare redemption." });
  }
}
