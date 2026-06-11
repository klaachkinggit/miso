import { NextResponse, type NextRequest } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { createOnboardingLink } from "@/lib/stripe-marketplace/seller-accounts";
import { OnboardingLinkInitSchema } from "@/lib/stripe-marketplace/schemas";
import { getRequestOrigin } from "@/lib/url";

export async function POST(request: NextRequest) {
  try {
    // Only sellers onboard. Controllers don't sell. Anonymous can't.
    const profile = await requireApiProfile({
      denyRoles: ["controller"],
      deniedMessage: "Controllers cannot onboard as sellers.",
    });
    const body = await parseJsonBody(
      request,
      OnboardingLinkInitSchema,
      "Invalid onboarding request.",
    );
    const result = await createOnboardingLink({
      userId: profile.id,
      email: profile.email,
      appUrl: getRequestOrigin(request),
      returnPath: body.return_path,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ApiRouteError) return apiErrorResponse(error);
    return apiErrorResponse(error, { fallback: "Onboarding link failed." });
  }
}
