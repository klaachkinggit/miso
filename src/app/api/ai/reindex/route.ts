import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAuthenticatedProfile } from "@/lib/api/auth";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { getOrganizationRole } from "@/lib/organizations/auth";
import { enforceRateLimit, rateLimitedResponseBody } from "@/lib/rate-limit";
import { reindexOrganization } from "@/lib/ai/indexing";

const ReindexRequestSchema = z.object({ organizationId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    const { organizationId } = await parseJsonBody(
      request,
      ReindexRequestSchema,
      "Invalid request.",
    );

    const role = await getOrganizationRole(profile.id, organizationId);
    if (role !== "admin") throw new ApiRouteError("Org admin required.", 403);

    if (!(await enforceRateLimit("ai", profile.id)).allowed) {
      return NextResponse.json(rateLimitedResponseBody(), { status: 429 });
    }

    const result = await reindexOrganization(organizationId);
    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Reindex failed." });
  }
}
