import { NextResponse, type NextRequest } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import {
  checkoutSalesChannel,
  checkoutTrackingOrigin,
  sourcePathFromReturnPath,
} from "@/lib/checkout/attribution";
import { createPrimaryCheckout } from "@/lib/stripe-marketplace/payments";
import { PrimaryCheckoutInitSchema } from "@/lib/stripe-marketplace/schemas";
import { enforceRateLimit, rateLimitedResponseBody } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot purchase tickets.",
    );
    if (!(await enforceRateLimit("checkout", profile.id)).allowed) {
      return NextResponse.json(rateLimitedResponseBody(), { status: 429 });
    }
    const body = await parseJsonBody(
      request,
      PrimaryCheckoutInitSchema,
      "Invalid checkout request.",
    );
    const idempotencyKey = request.headers
      .get("idempotency-key")
      ?.slice(0, 128);
    const salesChannel = checkoutSalesChannel("primary");
    const trackingOrigin = checkoutTrackingOrigin(
      request,
      sourcePathFromReturnPath(body.return_path) ?? null,
    );
    const result = await createPrimaryCheckout({
      buyerUserId: profile.id,
      categoryId: body.category_id,
      quantity: body.quantity,
      extraGuestsCount: body.extra_guests_count,
      giftRecipientEmail: body.gift_recipient_email,
      idempotencyKey,
      salesChannel,
      trackingOrigin,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return apiErrorResponse(error, { fallback: "Checkout failed." });
  }
}
