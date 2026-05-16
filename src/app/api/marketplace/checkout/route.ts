import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { apiErrorResponse, chainPendingResponse } from "@/lib/api/errors";
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

    const listing = await checkoutResaleListing({
      listingId: body.listing_id,
      buyerUserId: profile.id,
    });
    const appUrl = getRequestOrigin(request);
    return NextResponse.json({
      url: `${appUrl}/marketplace/success?listing_id=${listing.id}&mock=1`,
    });
  } catch (error) {
    // Chain in-flight (timeout, unknown wait error) OR mined-then-DB
    // failed (repair). Surface 202 so the client polls; admin retry
    // resumes. Do NOT collapse these into 400 — the buyer's NFT may
    // be (or already is) on chain.
    if (
      error instanceof ResaleTransferPendingError ||
      error instanceof ChainOpInFlightError ||
      error instanceof ChainOpRepairError
    ) {
      return chainPendingResponse();
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
