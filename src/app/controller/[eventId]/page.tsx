import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canOperateEventGate } from "@/lib/gates/operations";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, TicketCategory, TicketRedemption } from "@/types/db";
import { GatePanel } from "./gate-panel";

export default async function ControllerEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const [{ eventId }, profile] = await Promise.all([params, getCurrentProfile()]);
  if (!profile || !["controller", "admin"].includes(profile.role)) redirect("/");

  const sb = createServiceClient();
  const { data: event } = await sb.from("events").select("*").eq("id", eventId).single<EventRow>();
  if (!event) notFound();

  const canOperateGate = await canOperateEventGate({ eventId, profile });
  if (!canOperateGate) redirect("/controller");

  const { data: redemptions } = await sb
    .from("ticket_redemptions")
    .select("*")
    .eq("event_id", eventId)
    .order("redeemed_at", { ascending: false })
    .limit(20)
    .returns<TicketRedemption[]>();

  const { data: categories } = await sb
    .from("ticket_categories")
    .select("id, name, kind")
    .eq("event_id", eventId)
    .order("price", { ascending: true })
    .returns<Array<Pick<TicketCategory, "id" | "name" | "kind">>>();

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const host = hdrs.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[420px_1fr]">
      <div>
        <div className="mb-5">
          <h1 className="text-3xl font-semibold">{event.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(event.date)} · {event.venue_name}, {event.city}
          </p>
        </div>
        <GatePanel eventId={event.id} origin={origin} categories={categories ?? []} />
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Recent scans</h2>
        <div className="grid gap-3">
          {redemptions?.length ? (
            redemptions.map((redemption) => (
              <Card key={redemption.id} className="glass rounded-lg">
                <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Badge variant={redemption.result === "valid" ? "success" : "destructive"}>{redemption.result}</Badge>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDate(redemption.redeemed_at)}{redemption.gate_name ? ` · ${redemption.gate_name}` : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="glass rounded-lg">
              <CardContent className="p-5 text-sm text-muted-foreground">No scans yet.</CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
