import Link from "next/link";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/site/event-card";
import { EmptyState } from "@/components/site/empty-state";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

const QUICK_FILTERS = ["All", "Tonight", "This week", "Weekend", "Next month"] as const;

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
    <div className="container py-8 pb-20 md:py-12 md:pb-12">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="display text-4xl md:text-6xl">Events</h1>
        <p className="mono-stub text-white/60">
          {events?.length ?? 0} happening · on-chain tickets · tap to enter
        </p>
      </div>

      <div className="-mx-6 mb-8 flex gap-2 overflow-x-auto px-6 pb-2 [&::-webkit-scrollbar]:hidden">
        {QUICK_FILTERS.map((label, i) => (
          <Link
            key={label}
            href="/events"
            className={
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
              (i === 0
                ? "border-transparent bg-[hsl(var(--accent))] text-black"
                : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]")
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {events?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No events yet"
          description="Check back after an organizer publishes an event."
        />
      )}
    </div>
  );
}
