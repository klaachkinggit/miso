// POST /api/redeem/confirm — flip the ticket → used and write the on-chain
// `Redeemed=true` attribute via the backend wallet. DB is the source of truth;
// on-chain failure is logged for retry but does not block the redemption.

import { NextResponse, type NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { RedeemConfirmSchema } from "@/lib/schemas";
import { confirmRedemption } from "@/lib/verification/redeem";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = await parseJsonBody(
      request,
      RedeemConfirmSchema,
      "Invalid confirm payload.",
    );
    const outcome = await confirmRedemption({
      userId: user.id,
      gateShortCode: body.gate_short_code,
      ticketId: body.ticket_id,
      token: body.token,
    });

    const httpStatus = outcome.result === "valid" ? 200 : 409;
    return NextResponse.json(outcome, { status: httpStatus });
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    throw error;
  }
}
