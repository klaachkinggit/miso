import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canOperateEventGate } from "@/lib/gates/operations";
import { getConfiguredAppUrl } from "@/lib/url";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, TicketCategory, TicketRedemption } from "@/types/db";
import { GatePanel } from "./gate-panel";

export default async function ControllerEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const [{ eventId }, profile] = await Promise.all([
    params,
    getCurrentProfile(),
  ]);
  if (!profile) redirect("/login");

  // Authorize before fetching so unauthorized users cannot probe event existence.
  const canOperateGate = await canOperateEventGate({ eventId, profile });
  if (!canOperateGate) redirect("/controller");

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single<EventRow>();
  if (!event) notFound();

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

  const origin = getConfiguredAppUrl();

  return (
    <div className="container py-12">
      <header className="mb-10 border-b border-hairline pb-8">
        <p className="eyebrow-signal">Door · Gate</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-5xl">
          {event.name}
          <span className="display-italic">.</span>
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {formatDate(event.date)} · {event.venue_name}, {event.city}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[420px_1fr]">
        <GatePanel
          eventId={event.id}
          origin={origin}
          categories={categories ?? []}
        />

        <section>
          <p className="eyebrow mb-4">Recent scans</p>
          {redemptions?.length ? (
            <ol className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
              {redemptions.map((redemption) => (
                <li
                  key={redemption.id}
                  className="flex items-center justify-between gap-3 bg-ink-raised p-4"
                >
                  <Badge
                    variant={
                      redemption.result === "valid" ? "signal" : "destructive"
                    }
                  >
                    {redemption.result}
                  </Badge>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {formatDate(redemption.redeemed_at)}
                    {redemption.gate_name ? ` · ${redemption.gate_name}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-md border border-dashed border-hairline bg-ink-raised p-6 text-sm text-muted-foreground">
              No scans yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
