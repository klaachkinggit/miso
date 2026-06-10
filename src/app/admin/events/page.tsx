import Link from "next/link";
import { CalendarPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/site/empty-state";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { formatDateShort } from "@/lib/format";
import { shouldUseLegacyOrganizerEventScope } from "@/lib/organizations/auth";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
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
  const { activeOrganization } = await getActiveAdminOrganization(profile);
  if (activeOrganization) {
    query = query.eq("organization_id", activeOrganization.id);
  } else if (shouldUseLegacyOrganizerEventScope(profile, Boolean(activeOrganization))) {
    query = query.eq("organizer_user_id", profile.id);
  }
  const { data: events } = await query.returns<EventRow[]>();

  return (
    <div className="container py-10">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace · Events</p>
          <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">Events.</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            {activeOrganization
              ? `Create and manage events for ${activeOrganization.name}.`
              : "Create events, manage inventory, invite controllers, refund tickets."}
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
        <div className="mb-6 rounded-md border border-signal/40 bg-signal/10 p-3 text-sm text-signal">
          {params.success}
        </div>
      ) : null}

      {events?.length ? (
        <ol className="space-y-px overflow-hidden rounded-md border border-hairline bg-hairline">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-col gap-4 bg-ink-raised p-5 transition-colors hover:bg-ink-soft md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-medium text-foreground">{event.name}</h2>
                  <Badge variant={event.status === "published" ? "signal" : "secondary"}>
                    {event.status}
                  </Badge>
                  {event.status !== "draft" && !event.nft_contract_address ? (
                    <Badge variant="warning">contract pending</Badge>
                  ) : null}
                </div>
                <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDateShort(event.date)} · {event.venue_name}, {event.city}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/admin/events/${event.id}`}>
                  <Settings className="h-4 w-4" /> Manage
                </Link>
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No events yet"
          description="Create the first event and deploy its on-chain ticket contract."
        >
          <Button asChild>
            <Link href="/admin/events/new">Create event</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
