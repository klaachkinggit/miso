// POST /api/redeem/prepare — customer-side: build the demo redeem payload
// that proves Ticket ownership for the Gate.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { RedeemPrepareSchema } from "@/lib/schemas";
import { prepareRedemption } from "@/lib/verification/redeem";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const parsed = RedeemPrepareSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid redeem payload." }, { status: 400 });

  try {
    const { prepared, gate, ticket } = await prepareRedemption({
      userId: user.id,
      gateShortCode: parsed.data.gate_short_code,
      ticketId: parsed.data.ticket_id,
    });
    return NextResponse.json({
      prepared,
      gate: { id: gate.id, short_code: gate.short_code, gate_name: gate.gate_name, event_id: gate.event_id },
      ticket: { id: ticket.id, serial_number: ticket.serial_number },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare redemption." },
      { status: 400 }
    );
  }
}
