import { redirect } from "next/navigation";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

export default async function EventsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "controller") redirect("/controller");

  const sb = createServiceClient();
  const { data: events } = await sb
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("date", { ascending: true })
    .returns<EventRow[]>();

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Events</h1>
        <p className="mt-2 text-muted-foreground">Browse published Miso events.</p>
      </div>
      {events?.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState title="No events available" description="Check back after an organizer publishes an event." />
      )}
    </div>
  );
}
