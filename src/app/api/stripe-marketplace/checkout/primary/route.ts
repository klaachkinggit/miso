import { NextResponse, type NextRequest } from "next/server";
import { requireApiNonControllerProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { createPrimaryCheckout } from "@/lib/stripe-marketplace/payments";
import { PrimaryCheckoutInitSchema } from "@/lib/stripe-marketplace/schemas";

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiNonControllerProfile(
      "Controllers cannot purchase tickets.",
    );
    const body = await parseJsonBody(
      request,
      PrimaryCheckoutInitSchema,
      "Invalid checkout request.",
    );
    const idempotencyKey = request.headers
      .get("idempotency-key")
      ?.slice(0, 128);
    const result = await createPrimaryCheckout({
      buyerUserId: profile.id,
      categoryId: body.category_id,
      idempotencyKey,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return apiErrorResponse(error, { fallback: "Checkout failed." });
  }
}
