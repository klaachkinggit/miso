import Link from "next/link";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { getCurrentProfile } from "@/lib/auth";
import { formatDateShort } from "@/lib/format";
import { getAdminOrganizationIds } from "@/lib/organizations/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export default async function ControllerPage() {
  const profile = await getCurrentProfile();
  const sb = createServiceClient();

  let events: EventRow[] = [];
  const adminOrganizationIds = profile ? await getAdminOrganizationIds(profile.id) : [];
  if (profile?.role === "admin" && !adminOrganizationIds.length) {
    const { data } = await sb.from("events").select("*").order("date", { ascending: true }).returns<EventRow[]>();
    events = data ?? [];
  } else if (profile) {
    const byId = new Map<string, EventRow>();
    if (adminOrganizationIds.length) {
      const { data } = await sb
        .from("events")
        .select("*")
        .in("organization_id", adminOrganizationIds)
        .order("date", { ascending: true })
        .returns<EventRow[]>();
      for (const event of data ?? []) byId.set(event.id, event);
    }
    const { data: links } = await sb
      .from("event_controllers")
      .select("event_id")
      .eq("user_id", profile.id)
      .returns<Array<{ event_id: string }>>();
    const ids = links?.map((link) => link.event_id) ?? [];
    if (ids.length) {
      const { data } = await sb.from("events").select("*").in("id", ids).order("date", { ascending: true }).returns<EventRow[]>();
      for (const event of data ?? []) byId.set(event.id, event);
    }
    events = Array.from(byId.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Controller</h1>
        <p className="mt-2 text-muted-foreground">Choose an event to verify entry codes.</p>
      </div>
      {events.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((event) => (
            <Card key={event.id} className="glass rounded-lg">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{event.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateShort(event.date)} · {event.venue_name}, {event.city}
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/controller/${event.id}`}>
                    <ScanLine className="h-4 w-4" />
                    Scan
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No controller assignments" description="An admin must invite you to an event before scanning." />
      )}
    </div>
  );
}
