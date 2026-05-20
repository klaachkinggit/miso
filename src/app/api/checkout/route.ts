import { NextResponse, type NextRequest } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import {
  ApiRouteError,
  apiErrorResponse,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { createPurchaseCheckout } from "@/lib/payments/checkout";
import { PurchaseInitSchema } from "@/lib/schemas";
import { getRequestOrigin } from "@/lib/url";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot purchase tickets.",
    );
    const body = await parseJsonBody(request, PurchaseInitSchema, "Invalid checkout request.");

    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128);
    const appUrl = getRequestOrigin(request);

    const checkout = await createPurchaseCheckout({
      buyerUserId: profile.id,
      categoryId: body.category_id,
      quantity: body.quantity,
      extraGuestsCount: body.extra_guests_count,
      giftRecipientEmail: body.gift_recipient_email,
      idempotencyKey,
      successUrl: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/checkout/cancel`,
    });

    return NextResponse.json({ url: checkout.checkoutUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return apiErrorResponse(error, { fallback: "Checkout failed." });
  }
}
