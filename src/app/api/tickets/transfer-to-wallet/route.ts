import { NextResponse, type NextRequest } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import {
  ChainOpInFlightError,
  ChainOpRepairError,
} from "@/lib/chain/ops";
import { TransferToWalletSchema } from "@/lib/schemas";
import { transferTicketToPersonalWallet } from "@/lib/tickets/wallet-export";
import type { Address } from "viem";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot transfer tickets.",
    );
    const body = await parseJsonBody(
      request,
      TransferToWalletSchema,
      "Invalid transfer request.",
    );

    const result = await transferTicketToPersonalWallet({
      ticketId: body.ticket_id,
      userId: profile.id,
      destinationAddress: body.destination_address as Address,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof ChainOpInFlightError ||
      error instanceof ChainOpRepairError
    ) {
      return NextResponse.json({ error: "Transfer in progress." }, { status: 202 });
    }
    return apiErrorResponse(error, { fallback: "Transfer failed." });
  }
}
