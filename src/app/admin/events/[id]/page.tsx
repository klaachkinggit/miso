import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Profile, Ticket, TicketCategory } from "@/types/db";
import { CategoriesPanel } from "./categories-panel";
import { ControllersPanel, type ControllerRow } from "./controllers-panel";
import { DetailsForm } from "./details-form";
import { RefundsPanel } from "./refunds-panel";

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

  const { data: event } = await sb.from("events").select("*").eq("id", id).single<EventRow>();
  if (!event) notFound();
  if (profile.role === "organizer" && event.organizer_user_id !== profile.id) notFound();

  const [{ data: categories }, { data: controllerLinks }, { data: tickets }] = await Promise.all([
    sb.from("ticket_categories").select("*").eq("event_id", id).order("created_at", { ascending: true }).returns<TicketCategory[]>(),
    sb.from("event_controllers").select("user_id").eq("event_id", id).returns<Array<{ user_id: string }>>(),
    sb
      .from("tickets")
      .select("*")
      .eq("event_id", id)
      .in("status", ["sold", "listed", "used", "refund_pending", "refunded"])
      .order("serial_number", { ascending: true })
      .returns<Ticket[]>(),
  ]);

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

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{event.name}</h1>
        <p className="mt-2 text-muted-foreground">Manage event setup, inventory, scanners, and refunds.</p>
      </div>
      {notices?.error ? (
        <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {notices.error}
        </div>
      ) : null}
      {notices?.warning ? (
        <div className="mb-5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {notices.warning}
        </div>
      ) : null}

      <Tabs defaultValue="details">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="controllers">Controllers</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
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
          <RefundsPanel tickets={tickets ?? []} categories={categories ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
