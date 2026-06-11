import { NextResponse, type NextRequest } from "next/server";
import { loadOrganizationAnalytics } from "@/lib/analytics/organization";
import { serializeAnalyticsCsv } from "@/lib/analytics/csv";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { requireApiAuthenticatedProfile } from "@/lib/api/auth";
import {
  ActiveAdminOrganizationRequired,
  requireActiveAdminOrganization,
} from "@/lib/organizations/context";
import { parseAnalyticsSearchParams } from "@/lib/analytics/search-params";

export async function GET(request: NextRequest) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    let activeOrganization;
    try {
      ({ activeOrganization } = await requireActiveAdminOrganization(profile));
    } catch (error) {
      if (error instanceof ActiveAdminOrganizationRequired) {
        throw new ApiRouteError("No active organization for this account.", 400);
      }
      throw error;
    }

    const searchParams: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      searchParams[key] = value;
    });

    const parsed = parseAnalyticsSearchParams(searchParams);
    const analytics = await loadOrganizationAnalytics({
      organizationId: activeOrganization.id,
      range: parsed.range,
      compare: parsed.compare,
      filters: parsed.filters,
    });

    const csv = serializeAnalyticsCsv(analytics);
    const slug = activeOrganization.slug ?? "organization";
    const filename = `${slug}-analytics-${parsed.range.preset}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, { fallback: "Analytics export failed." });
  }
}
