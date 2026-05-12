import Link from "next/link";
import { CalendarPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { formatDateShort } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export default async function AdminPage() {
  const sb = createServiceClient();
  const { data: events } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<EventRow[]>();

  return (
    <div className="container py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Admin</h1>
          <p className="mt-2 text-muted-foreground">Create events, manage inventory, invite controllers, and refund tickets.</p>
        </div>
        <Button asChild>
          <Link href="/admin/events/new">
            <CalendarPlus className="h-4 w-4" />
            New event
          </Link>
        </Button>
      </div>
      {events?.length ? (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id} className="glass rounded-lg">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{event.name}</h2>
                    <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
                    {!event.solana_collection_address ? <Badge variant="warning">collection pending</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(event.date)} at {event.venue_name}, {event.city}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/admin/events/${event.id}`}>
                    <Settings className="h-4 w-4" />
                    Manage
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No events yet" description="Create the first event and mint its Solana collection.">
          <Button asChild>
            <Link href="/admin/events/new">Create event</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
