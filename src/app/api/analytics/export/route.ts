import { NextResponse, type NextRequest } from "next/server";
import { loadOrganizationAnalytics } from "@/lib/analytics/organization";
import { serializeAnalyticsCsv } from "@/lib/analytics/csv";
import { ApiRouteError, apiErrorResponse } from "@/lib/api/errors";
import { requireApiAuthenticatedProfile } from "@/lib/api/auth";
import { getOrganizationRole } from "@/lib/organizations/auth";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
import { parseAnalyticsSearchParams } from "@/lib/analytics/search-params";

export async function GET(request: NextRequest) {
  try {
    const profile = await requireApiAuthenticatedProfile();
    const { activeOrganization } = await getActiveAdminOrganization(profile);
    if (!activeOrganization) {
      throw new ApiRouteError("No active organization for this account.", 400);
    }
    const role = await getOrganizationRole(profile.id, activeOrganization.id);
    if (role !== "admin" && profile.role !== "admin") {
      throw new ApiRouteError("Only organization admins can export analytics.", 403);
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
