// POST /api/redeem/confirm — flip the ticket → used and write the on-chain
// `Redeemed=true` attribute via the backend wallet. DB is the source of truth;
// on-chain failure is logged for retry but does not block the redemption.

import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { RedeemConfirmSchema } from "@/lib/schemas";
import { confirmRedemption } from "@/lib/verification/redeem";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json();
  const parsed = RedeemConfirmSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirm payload." }, { status: 400 });

  const outcome = await confirmRedemption({
    userId: user.id,
    gateShortCode: parsed.data.gate_short_code,
    ticketId: parsed.data.ticket_id,
  });

  const httpStatus = outcome.result === "valid" ? 200 : 409;
  return NextResponse.json(outcome, { status: httpStatus });
}
