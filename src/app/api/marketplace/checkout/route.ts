import { NextResponse, type NextRequest } from "next/server";
import {
  assertNotOrganizationController,
  requireApiNonControllerProfile,
} from "@/lib/api/auth";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import {
  checkoutSalesChannel,
  checkoutTrackingOrigin,
  sourcePathFromReturnPath,
} from "@/lib/checkout/attribution";
import {
  ChainOpInFlightError,
  ChainOpRepairError,
} from "@/lib/chain/ops";
import { resaleCheckoutCancelPath } from "@/lib/marketplace/public";
import { resourceOrganizationId } from "@/lib/organizations/auth";
import {
  checkoutResaleListing,
  ResaleCheckoutPreflightError,
  ResaleTransferPendingError,
} from "@/lib/resale/listing";
import { ResaleCheckoutSchema } from "@/lib/schemas";
import { getRequestOrigin } from "@/lib/url";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot use the marketplace.",
    );
    const body = await parseJsonBody(request, ResaleCheckoutSchema, "Invalid checkout request.");
    await assertNotOrganizationController({
      profile,
      organizationId: await resourceOrganizationId({ kind: "listing", id: body.listing_id }),
      deniedMessage: "Controllers cannot use this organization marketplace.",
    });

    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128);
    const appUrl = getRequestOrigin(request);
    const cancelPath = await resaleCheckoutCancelPath(body.listing_id);
    const { checkoutUrl } = await checkoutResaleListing({
      listingId: body.listing_id,
      buyerUserId: profile.id,
      successUrl: `${appUrl}/marketplace/success?session_id={CHECKOUT_SESSION_ID}&listing_id=${body.listing_id}`,
      cancelUrl: `${appUrl}${cancelPath}`,
      idempotencyKey,
      salesChannel: checkoutSalesChannel("resale"),
      trackingOrigin: checkoutTrackingOrigin(
        request,
        sourcePathFromReturnPath(body.return_path) ?? cancelPath,
      ),
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
