import { NextResponse } from "next/server";
import { buildIcs } from "@/lib/calendar";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3002"
).replace(/\/+$/, "");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle<EventRow>();

  if (error) return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const filename = (data.slug ?? data.id) + ".ics";
  const ics = buildIcs({
    name: data.name,
    description: data.description,
    venueName: data.venue_name,
    city: data.city,
    date: data.date,
    endDate: null,
    url: `${appUrl}/events/${data.id}`,
    uid: `event-${data.id}@miso`,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
