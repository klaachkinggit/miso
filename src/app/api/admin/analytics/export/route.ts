import { NextResponse, type NextRequest } from "next/server";
import { loadOrganizationAnalytics } from "@/lib/analytics/organization";
import { parseAnalyticsSearchParams } from "@/lib/analytics/search-params";
import { requireApiAuthenticatedProfile } from "@/lib/api/auth";
import {
  ActiveAdminOrganizationRequired,
  requireActiveAdminOrganization,
} from "@/lib/organizations/context";
import { csvRow } from "@/lib/csv";

export async function GET(request: NextRequest) {
  let profile;
  try {
    profile = await requireApiAuthenticatedProfile();
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  let activeOrganization;
  try {
    ({ activeOrganization } = await requireActiveAdminOrganization(profile));
  } catch (error) {
    if (error instanceof ActiveAdminOrganizationRequired) {
      return new NextResponse(null, { status: 404 });
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

  const header = csvRow([
    "event_id",
    "name",
    "date",
    "city",
    "venue",
    "capacity",
    "tickets_sold",
    "tickets_redeemed",
    "revenue_paid",
    "currency",
    "attendance_rate",
    "sellout_rate",
  ]);
  const lines = [header];
  for (const e of analytics.events) {
    lines.push(
      csvRow([
        e.event_id,
        e.name,
        e.date,
        e.city,
        e.venue_name,
        e.capacity,
        e.tickets_sold,
        e.tickets_redeemed,
        e.revenue_paid,
        e.currency,
        e.attendance_rate,
        e.sellout_rate,
      ]),
    );
  }
  const csv = lines.join("\n");

  const slug = activeOrganization.slug ?? "organization";
  const filename = `${slug}-events-${parsed.range.preset}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
