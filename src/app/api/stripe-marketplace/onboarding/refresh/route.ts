import { NextResponse, type NextRequest } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { getSellerAccountByUserId } from "@/lib/stripe-marketplace/seller-accounts";
import { syncSellerAccountFromStripe } from "@/lib/stripe-marketplace/seller-accounts";
import { getRequestOrigin } from "@/lib/url";

// Stripe redirects here when the hosted onboarding flow needs the
// seller to start over (e.g. session expired). We poll Stripe for the
// account state and bounce the browser back to the Smartboard banking tab.
export async function GET(request: NextRequest) {
  try {
    const profile = await requireApiProfile({
      denyRoles: ["controller"],
      deniedMessage: "Controllers cannot onboard as sellers.",
    });
    const seller = await getSellerAccountByUserId(profile.id);
    if (seller) {
      await syncSellerAccountFromStripe(seller.stripe_account_id);
    }
    const requestedPath = request.nextUrl.searchParams.get("return_path");
    const returnPath =
      requestedPath && requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/smartboard?tab=banking";
    const appUrl = getRequestOrigin(request);
    return NextResponse.redirect(`${appUrl}${returnPath}`, 302);
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return apiErrorResponse(error, { fallback: "Onboarding refresh failed." });
  }
}
