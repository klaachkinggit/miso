import Link from "next/link";
import { CalendarPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { formatDateShort } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export default async function AdminEventsListPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const profile = await requireOrganizerWorkspace();
  const sb = createServiceClient();
  let query = sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (profile.role === "organizer") {
    query = query.eq("organizer_user_id", profile.id);
  }
  const { data: events } = await query.returns<EventRow[]>();

  return (
    <div className="container py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Events</h1>
          <p className="mt-2 text-muted-foreground">
            Create events, manage inventory, invite controllers, and refund tickets.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <CalendarPlus className="h-4 w-4" /> New event
          </Link>
        </Button>
      </div>

      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {params.success}
        </div>
      ) : null}

      {events?.length ? (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id} className="glass rounded-lg">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{event.name}</h2>
                    <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
                    {event.status !== "draft" && !event.nft_contract_address ? (
                      <Badge variant="warning">contract pending</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(event.date)} at {event.venue_name}, {event.city}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/admin/events/${event.id}`}>
                    <Settings className="h-4 w-4" /> Manage
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No events yet" description="Create the first event and deploy its on-chain ticket contract.">
          <Button asChild>
            <Link href="/admin/events/new">Create event</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
