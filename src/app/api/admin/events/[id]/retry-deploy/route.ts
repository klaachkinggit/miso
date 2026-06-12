import { NextResponse, type NextRequest } from "next/server";

import { requireOrganizerWorkspace } from "@/lib/auth";
import { publishEventSetup } from "@/lib/events/setup";
import { canManageEvent } from "@/lib/organizations/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

// Resumes the publish pipeline when image pin or contract deploy failed mid-flight.
// `publishEventSetup` is idempotent: it skips steps already done and only re-runs
// what is missing, then re-asserts the published status.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireOrganizerWorkspace();
  const { id } = await params;
  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .single<EventRow>();
  const target = new URL(`/admin/events/${id}`, request.url);

  if (!event) {
    target.searchParams.set("error", "Event not found.");
    return NextResponse.redirect(target);
  }
  if (!(await canManageEvent(admin, event))) {
    target.searchParams.set("error", "You can only manage events for your organization.");
    return NextResponse.redirect(new URL("/admin/events", request.url));
  }

  try {
    await publishEventSetup({ eventId: event.id, actorUserId: admin.id });
  } catch (err) {
    target.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Deploy retry failed",
    );
  }

  return NextResponse.redirect(target);
}
