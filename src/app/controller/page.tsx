import Link from "next/link";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const adminOrganizationIds = profile
    ? await getAdminOrganizationIds(profile.id)
    : [];
  if (profile?.role === "admin" && !adminOrganizationIds.length) {
    const { data } = await sb
      .from("events")
      .select("*")
      .order("date", { ascending: true })
      .returns<EventRow[]>();
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
      const { data } = await sb
        .from("events")
        .select("*")
        .in("id", ids)
        .order("date", { ascending: true })
        .returns<EventRow[]>();
      for (const event of data ?? []) byId.set(event.id, event);
    }
    events = Array.from(byId.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  return (
    <div className="container py-12">
      <header className="mb-10 border-b border-hairline pb-8">
        <p className="eyebrow-signal">Door · Controller</p>
        <h1 className="display mt-4 text-4xl text-foreground md:text-6xl">
          Controller<span className="display-italic">.</span>
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Pick an event to verify entry codes at the door.
        </p>
      </header>
      {events.length ? (
        <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-4 bg-ink-raised p-5 transition-colors hover:bg-ink-soft md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <h2 className="display text-2xl text-foreground">
                  {event.name}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDateShort(event.date)} · {event.venue_name},{" "}
                  {event.city}
                </p>
              </div>
              <Button asChild>
                <Link href={`/controller/${event.id}`}>
                  <ScanLine className="h-4 w-4" />
                  Scan
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No controller assignments"
          description="An admin must invite you to an event before scanning."
        />
      )}
    </div>
  );
}
