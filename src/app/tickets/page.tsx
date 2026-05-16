import { redirect } from "next/navigation";
import { EmptyState } from "@/components/site/empty-state";
import { PageHeader } from "@/components/site/page-header";
import { TicketCard } from "@/components/tickets/ticket-card";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, ResaleListing, Ticket, TicketCategory } from "@/types/db";

export default async function TicketsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "controller") redirect("/controller");

  const sb = createServiceClient();
  const { data: tickets } = await sb
    .from("tickets")
    .select("*")
    .eq("owner_user_id", profile.id)
    .in("status", ["sold", "listed", "used", "expired", "refund_pending", "refunded", "canceled"])
    .order("created_at", { ascending: false })
    .returns<Ticket[]>();

  const eventIds = [...new Set(tickets?.map((ticket) => ticket.event_id) ?? [])];
  const categoryIds = [...new Set(tickets?.map((ticket) => ticket.category_id) ?? [])];
  const listingIds = [
    ...new Set(
      (tickets ?? [])
        .map((t) => t.current_listing_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: events }, { data: categories }, { data: listings }] = await Promise.all([
    eventIds.length
      ? sb.from("events").select("*").in("id", eventIds).returns<EventRow[]>()
      : Promise.resolve({ data: [] as EventRow[] }),
    categoryIds.length
      ? sb.from("ticket_categories").select("*").in("id", categoryIds).returns<TicketCategory[]>()
      : Promise.resolve({ data: [] as TicketCategory[] }),
    listingIds.length
      ? sb.from("resale_listings").select("*").in("id", listingIds).returns<ResaleListing[]>()
      : Promise.resolve({ data: [] as ResaleListing[] }),
  ]);

  const eventById = new Map((events ?? []).map((event) => [event.id, event]));
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const listingById = new Map((listings ?? []).map((listing) => [listing.id, listing]));

  return (
    <div className="container py-10">
      <PageHeader
        title="Wallet"
        description="Your NFT tickets, QR access, resale status, and event ownership history."
        className="mb-8"
      />
      {tickets?.length ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => {
            const event = eventById.get(ticket.event_id);
            if (!event) return null;
            const category = categoryById.get(ticket.category_id) ?? null;
            const listing = ticket.current_listing_id
              ? listingById.get(ticket.current_listing_id) ?? null
              : null;
            const eventFuture = new Date(event.date).getTime() > Date.now();
            const canList =
              ticket.status === "sold" &&
              event.status === "published" &&
              event.resale_enabled &&
              category?.resale_enabled === true &&
              eventFuture;
            return (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                event={event}
                category={category}
                listing={listing}
                canList={canList}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState title="No tickets yet" description="After checkout completes, your NFT ticket appears here." />
      )}
    </div>
  );
}
