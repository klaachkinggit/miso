import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import {
  ChainOpInFlightError,
  ChainOpRepairError,
} from "@/lib/chain/ops";
import {
  checkoutResaleListing,
  ResaleCheckoutPreflightError,
  ResaleTransferPendingError,
} from "@/lib/resale/listing";
import { getRequestOrigin } from "@/lib/url";

const Body = z.object({ listing_id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot use the marketplace.",
    );
    const body = await parseJsonBody(request, Body, "Invalid checkout request.");

    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128);
    const appUrl = getRequestOrigin(request);
    const { checkoutUrl } = await checkoutResaleListing({
      listingId: body.listing_id,
      buyerUserId: profile.id,
      successUrl: `${appUrl}/marketplace/success?session_id={CHECKOUT_SESSION_ID}&listing_id=${body.listing_id}`,
      cancelUrl: `${appUrl}/marketplace/${body.listing_id}`,
      idempotencyKey,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    if (
      error instanceof ResaleTransferPendingError ||
      error instanceof ChainOpInFlightError ||
      error instanceof ChainOpRepairError
    ) {
      return NextResponse.json({ error: "Transfer in progress." }, { status: 202 });
    }
    if (error instanceof ResaleCheckoutPreflightError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return apiErrorResponse(error, { fallback: "Checkout failed." });
  }
}
