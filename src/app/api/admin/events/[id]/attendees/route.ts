import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { canManageEvent } from "@/lib/organizations/auth";
import { csvRow } from "@/lib/csv";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Profile, Ticket, TicketCategory } from "@/types/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .single<EventRow>();

  // 404 for unauthorized too, mirroring the admin event page — don't leak
  // event existence to non-managers.
  if (!event || !(await canManageEvent(profile, event))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: tickets }, { data: categories }] = await Promise.all([
    sb
      .from("tickets")
      .select("*")
      .eq("event_id", id)
      .in("status", ["sold", "listed", "used", "refund_pending", "refunded"])
      .order("serial_number", { ascending: true })
      .returns<Ticket[]>(),
    sb
      .from("ticket_categories")
      .select("*")
      .eq("event_id", id)
      .returns<TicketCategory[]>(),
  ]);

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const ownerIds = Array.from(
    new Set(
      (tickets ?? [])
        .map((t) => t.owner_user_id)
        .filter((uid): uid is string => !!uid),
    ),
  );

  const ownerById = new Map<
    string,
    Pick<Profile, "id" | "display_name" | "email">
  >();
  if (ownerIds.length) {
    const { data: ownerProfiles } = await sb
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ownerIds)
      .returns<Array<Pick<Profile, "id" | "display_name" | "email">>>();
    for (const p of ownerProfiles ?? []) {
      ownerById.set(p.id, p);
    }
  }

  const header = csvRow([
    "serial_number",
    "category_name",
    "status",
    "owner_display_name",
    "owner_email",
    "owner_evm_address",
    "minted_at",
  ]);

  const rows = (tickets ?? []).map((ticket) => {
    const category = categoryById.get(ticket.category_id);
    const owner = ticket.owner_user_id
      ? ownerById.get(ticket.owner_user_id)
      : undefined;
    return csvRow([
      ticket.serial_number,
      category?.name ?? "",
      ticket.status,
      owner?.display_name ?? "",
      owner?.email ?? "",
      ticket.owner_evm_address ?? "",
      ticket.minted_at ?? "",
    ]);
  });

  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${id}.csv"`,
    },
  });
}
