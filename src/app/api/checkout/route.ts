import { NextResponse, type NextRequest } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import {
  ApiRouteError,
  apiErrorResponse,
  chainPendingResponse,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { FulfillmentPendingError } from "@/lib/payments/settlement";
import { createPurchaseCheckout } from "@/lib/payments/checkout";
import { PurchaseInitSchema } from "@/lib/schemas";
import { getRequestOrigin } from "@/lib/url";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot purchase tickets.",
    );
    const body = await parseJsonBody(request, PurchaseInitSchema, "Invalid checkout request.");

    // Idempotency: clients can submit `Idempotency-Key` and we'll
    // return the original purchase's success URL on retry. Without
    // the header the route is non-idempotent (back-compat).
    const idempotencyKey = request.headers.get("idempotency-key")?.slice(0, 128);
    const checkout = await createPurchaseCheckout({
      buyerUserId: profile.id,
      categoryId: body.category_id,
      idempotencyKey,
    });
    const appUrl = getRequestOrigin(request);
    const bodyPayload = {
      url: `${appUrl}/checkout/success?purchase_id=${checkout.purchaseId}`,
      ...(checkout.status ? { status: checkout.status } : {}),
    };
    const httpStatus =
      checkout.idempotentReplay && checkout.status !== "paid" ? 202 : 200;

    return NextResponse.json(bodyPayload, { status: httpStatus });
  } catch (error) {
    if (error instanceof FulfillmentPendingError) {
      return chainPendingResponse();
    }
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return apiErrorResponse(error, { fallback: "Checkout failed." });
  }
}
