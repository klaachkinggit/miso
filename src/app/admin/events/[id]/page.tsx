import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { canManageEvent } from "@/lib/organizations/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  EventRow,
  MarketplacePayment,
  Profile,
  Ticket,
  TicketCategory,
} from "@/types/db";
import { CategoriesPanel } from "./categories-panel";
import { ControllersPanel, type ControllerRow } from "./controllers-panel";
import { DetailsForm } from "./details-form";
import { MarketplacePaymentsPanel } from "./marketplace-payments-panel";
import { RefundsPanel } from "./refunds-panel";
import { duplicateEventAction } from "../../actions";

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; warning?: string }>;
}) {
  const { id } = await params;
  const notices = await searchParams;
  const profile = await requireOrganizerWorkspace();
  const sb = createServiceClient();

  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .single<EventRow>();
  if (!event) notFound();
  if (!(await canManageEvent(profile, event))) notFound();

  const [
    { data: categories },
    { data: controllerLinks },
    { data: tickets },
    { data: purchaseIds },
    { data: ticketIds },
  ] = await Promise.all([
    sb
      .from("ticket_categories")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: true })
      .returns<TicketCategory[]>(),
    sb
      .from("event_controllers")
      .select("user_id")
      .eq("event_id", id)
      .returns<Array<{ user_id: string }>>(),
    sb
      .from("tickets")
      .select("*")
      .eq("event_id", id)
      .in("status", ["sold", "listed", "used", "refund_pending", "refunded"])
      .order("serial_number", { ascending: true })
      .returns<Ticket[]>(),
    sb
      .from("purchases")
      .select("id")
      .eq("event_id", id)
      .returns<Array<{ id: string }>>(),
    sb
      .from("tickets")
      .select("id")
      .eq("event_id", id)
      .returns<Array<{ id: string }>>(),
  ]);

  const pIds = (purchaseIds ?? []).map((r) => r.id);
  const tIds = (ticketIds ?? []).map((r) => r.id);

  const mpFromItems = pIds.length
    ? sb
        .from("marketplace_payment_items")
        .select("marketplace_payment_id")
        .in("purchase_id", pIds)
        .returns<Array<{ marketplace_payment_id: string }>>()
    : Promise.resolve({
        data: [] as Array<{ marketplace_payment_id: string }>,
      });

  const mpFromListings = tIds.length
    ? sb
        .from("resale_listings")
        .select("id")
        .in("ticket_id", tIds)
        .returns<Array<{ id: string }>>()
    : Promise.resolve({ data: [] as Array<{ id: string }> });

  const [{ data: itemLinks }, { data: listingLinks }] = await Promise.all([
    mpFromItems,
    mpFromListings,
  ]);

  const primaryPaymentIds = Array.from(
    new Set((itemLinks ?? []).map((r) => r.marketplace_payment_id)),
  );
  const { data: mpPrimary } = primaryPaymentIds.length
    ? await sb
        .from("marketplace_payments")
        .select("*")
        .in("id", primaryPaymentIds)
        .order("created_at", { ascending: false })
        .returns<MarketplacePayment[]>()
    : { data: [] as MarketplacePayment[] };

  const lIds = (listingLinks ?? []).map((r) => r.id);
  const { data: mpResale } = lIds.length
    ? await sb
        .from("marketplace_payments")
        .select("*")
        .in("resale_listing_id", lIds)
        .order("created_at", { ascending: false })
        .returns<MarketplacePayment[]>()
    : { data: [] as MarketplacePayment[] };

  const seenIds = new Set<string>();
  const marketplacePayments: MarketplacePayment[] = [];
  for (const p of [...(mpPrimary ?? []), ...(mpResale ?? [])]) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      marketplacePayments.push(p);
    }
  }
  marketplacePayments.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const controllerIds = controllerLinks?.map((row) => row.user_id) ?? [];
  let controllers: ControllerRow[] = [];
  if (controllerIds.length) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("*")
      .in("id", controllerIds)
      .returns<Profile[]>();
    controllers =
      profiles?.map((profile) => ({
        user_id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        role: profile.role,
      })) ?? [];
  }

  const ownerIds = Array.from(
    new Set(
      (tickets ?? [])
        .map((ticket) => ticket.owner_user_id)
        .filter((id): id is string => !!id),
    ),
  );
  const ownerLabels = new Map<string, string>();
  if (ownerIds.length) {
    const { data: ownerProfiles } = await sb
      .from("profiles")
      .select("id, display_name, email")
      .in("id", ownerIds)
      .returns<Array<Pick<Profile, "id" | "display_name" | "email">>>();
    for (const owner of ownerProfiles ?? []) {
      ownerLabels.set(owner.id, owner.display_name || owner.email);
    }
  }

  const buyerIds = Array.from(
    new Set(marketplacePayments.map((p) => p.buyer_user_id)),
  );
  const buyerLabels = new Map<string, string>();
  if (buyerIds.length) {
    const { data: buyerProfiles } = await sb
      .from("profiles")
      .select("id, display_name, email")
      .in("id", buyerIds)
      .returns<Array<Pick<Profile, "id" | "display_name" | "email">>>();
    for (const buyer of buyerProfiles ?? []) {
      buyerLabels.set(buyer.id, buyer.display_name || buyer.email);
    }
  }

  return (
    <div className="container py-10">
      <header className="mb-10 border-b border-hairline pb-8">
        <p className="eyebrow">Workspace · Event</p>
        <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">
          {event.name}
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Setup, inventory, scanners, refunds.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/events/${event.id}/attendees`} download>
              Export attendees CSV
            </a>
          </Button>
          <form action={duplicateEventAction}>
            <input type="hidden" name="event_id" value={event.id} />
            <Button type="submit" variant="outline" size="sm">
              Duplicate
            </Button>
          </form>
        </div>
      </header>
      {notices?.error ? (
        <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {notices.error}
        </div>
      ) : null}
      {notices?.warning ? (
        <div className="mb-5 rounded-md border border-hairline-strong bg-ink-soft px-3 py-2 text-sm text-foreground">
          {notices.warning}
        </div>
      ) : null}

      <Tabs defaultValue="details">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="controllers">Controllers</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <DetailsForm event={event} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesPanel eventId={event.id} categories={categories ?? []} />
        </TabsContent>
        <TabsContent value="controllers">
          <ControllersPanel eventId={event.id} controllers={controllers} />
        </TabsContent>
        <TabsContent value="refunds">
          <RefundsPanel
            tickets={tickets ?? []}
            categories={categories ?? []}
            ownerLabels={Object.fromEntries(ownerLabels)}
          />
        </TabsContent>
        <TabsContent value="marketplace">
          <MarketplacePaymentsPanel
            payments={marketplacePayments}
            eventId={event.id}
            buyerLabels={Object.fromEntries(buyerLabels)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
