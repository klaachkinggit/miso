import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole, Send, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth";
import { casablancaInputValue, formatPrice } from "@/lib/format";
import { getOrganizerCompliance } from "@/lib/organizers/profile";
import { eventHasActiveTickets } from "@/lib/organizers/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, Profile, TicketCategory } from "@/types/db";
import {
  createOrganizerCategory,
  inviteOrganizerController,
  publishOrganizerEvent,
  updateOrganizerEvent,
} from "../../actions";

const TAB_VALUES = ["details", "tickets", "door"] as const;

export default async function SmartboardEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; tab?: string }>;
}) {
  const profile = await requireRole("organizer");
  const { id } = await params;
  const notices = await searchParams;
  const tab = TAB_VALUES.includes(notices?.tab as (typeof TAB_VALUES)[number])
    ? (notices?.tab as (typeof TAB_VALUES)[number])
    : "details";

  const sb = createServiceClient();
  const { data: event } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("organizer_user_id", profile.id)
    .maybeSingle<EventRow>();
  if (!event) notFound();

  const [compliance, { data: categories }, { data: controllerLinks }] =
    await Promise.all([
      getOrganizerCompliance(profile.id),
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
    ]);
  if (!compliance.organizer) redirect("/onboarding");

  const controllerIds = controllerLinks?.map((row) => row.user_id) ?? [];
  const { data: controllerProfiles } = controllerIds.length
    ? await sb
        .from("profiles")
        .select("*")
        .in("id", controllerIds)
        .returns<Profile[]>()
    : { data: [] as Profile[] };
  const activeTickets = await eventHasActiveTickets(event.id);
  const doorEligible = event.status === "published" && activeTickets;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/smartboard">
            <ArrowLeft className="h-4 w-4" />
            Smartboard
          </Link>
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{event.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {event.venue_name}, {event.city}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={event.status === "published" ? "success" : "secondary"}
            >
              {event.status}
            </Badge>
            <Badge variant={compliance.live ? "success" : "warning"}>
              {compliance.live ? "Live" : "Sandbox"}
            </Badge>
          </div>
        </div>
      </div>

      {notices?.error ? (
        <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {notices.error}
        </div>
      ) : null}

      {!compliance.live ? (
        <Card className="mb-6 rounded-lg border-amber-500/40 bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Publishing is locked until legal and Stripe verification are
                complete.
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/smartboard?tab=banking">Open Banking</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue={tab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="door">Xpress Door</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <Card className="glass rounded-lg">
              <CardHeader>
                <CardTitle>Event details</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateOrganizerEvent} className="grid gap-4">
                  <input type="hidden" name="event_id" value={event.id} />
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={event.name}
                      required
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        name="date"
                        type="datetime-local"
                        defaultValue={casablancaInputValue(event.date)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        name="capacity"
                        type="number"
                        min="1"
                        defaultValue={event.capacity}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="venue_name">Venue</Label>
                      <Input
                        id="venue_name"
                        name="venue_name"
                        defaultValue={event.venue_name}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        name="city"
                        defaultValue={event.city}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      name="image_url"
                      type="url"
                      defaultValue={event.image_url ?? ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={4}
                      defaultValue={event.description ?? ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="conditions">Conditions</Label>
                    <Textarea
                      id="conditions"
                      name="conditions"
                      rows={3}
                      defaultValue={event.conditions ?? ""}
                    />
                  </div>
                  <div className="grid gap-3 rounded-md border border-border/70 p-4 text-sm">
                    <label className="flex items-center gap-3">
                      <input
                        name="sales_enabled"
                        type="checkbox"
                        className="h-4 w-4"
                        defaultChecked={event.sales_enabled}
                      />
                      Sales enabled
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        name="resale_enabled"
                        type="checkbox"
                        className="h-4 w-4"
                        defaultChecked={event.resale_enabled}
                      />
                      Resale enabled
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        name="public_sales_counter_enabled"
                        type="checkbox"
                        className="h-4 w-4"
                        defaultChecked={event.public_sales_counter_enabled}
                      />
                      Public sales counter
                    </label>
                    <div className="grid gap-2 pt-1">
                      <Label htmlFor="organizer_resale_royalty_pct">
                        Resale royalty (%)
                      </Label>
                      <Input
                        id="organizer_resale_royalty_pct"
                        name="organizer_resale_royalty_pct"
                        type="number"
                        step="0.5"
                        min="0"
                        max="50"
                        defaultValue={
                          (event.organizer_resale_royalty_bps ?? 0) / 100
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit">Save changes</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="glass h-fit rounded-lg">
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
                  <span>Ticket categories</span>
                  <Badge
                    variant={(categories ?? []).length ? "success" : "warning"}
                  >
                    {categories?.length ?? 0}
                  </Badge>
                </div>
                {event.status === "draft" ? (
                  <form action={publishOrganizerEvent}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <Button
                      type="submit"
                      disabled={!compliance.live || !(categories ?? []).length}
                      className="w-full"
                    >
                      Publish event
                    </Button>
                  </form>
                ) : (
                  <Button asChild className="w-full">
                    <Link href={`/events/${event.id}`}>View storefront</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4">
              {(categories ?? []).length ? (
                (categories ?? []).map((category) => (
                  <Card key={category.id} className="glass rounded-lg">
                    <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{category.name}</h3>
                          <Badge variant="secondary">
                            {formatPrice(category.price, category.currency)}
                          </Badge>
                          <Badge variant="success">
                            {category.supply} generated
                          </Badge>
                        </div>
                        {category.description ? (
                          <p className="text-sm text-muted-foreground">
                            {category.description}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="glass rounded-lg">
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    No ticket categories yet.
                  </CardContent>
                </Card>
              )}
            </div>
            <Card className="glass h-fit rounded-lg">
              <CardHeader>
                <CardTitle>Add category</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createOrganizerCategory} className="grid gap-4">
                  <input type="hidden" name="event_id" value={event.id} />
                  <div className="grid gap-2">
                    <Label htmlFor="category-name">Name</Label>
                    <Input id="category-name" name="name" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category-description">Description</Label>
                    <Textarea
                      id="category-description"
                      name="description"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="currency">Currency</Label>
                      <select
                        id="currency"
                        name="currency"
                        defaultValue="EUR"
                        className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm"
                      >
                        <option value="EUR">EUR</option>
                        <option value="MAD">MAD draft</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="supply">Supply</Label>
                      <Input
                        id="supply"
                        name="supply"
                        type="number"
                        min="1"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="max_resale_price">Max resale</Label>
                      <Input
                        id="max_resale_price"
                        name="max_resale_price"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="benefits">Benefits</Label>
                    <Textarea id="benefits" name="benefits" rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="sale_starts_at">Sales start</Label>
                      <Input
                        id="sale_starts_at"
                        name="sale_starts_at"
                        type="datetime-local"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sale_ends_at">Sales end</Label>
                      <Input
                        id="sale_ends_at"
                        name="sale_ends_at"
                        type="datetime-local"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      name="resale_enabled"
                      type="checkbox"
                      className="h-4 w-4"
                      defaultChecked
                    />
                    Resale enabled
                  </label>
                  <Button type="submit">
                    <Ticket className="h-4 w-4" />
                    Create and seed tickets
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="door">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-4">
              {controllerProfiles?.length ? (
                controllerProfiles.map((controller) => (
                  <Card key={controller.id} className="glass rounded-lg">
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <div>
                        <h3 className="font-semibold">
                          {controller.display_name ?? controller.email}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {controller.email}
                        </p>
                      </div>
                      <Badge variant="secondary">{controller.role}</Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="glass rounded-lg">
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    {doorEligible
                      ? "No door staff invited yet."
                      : "Xpress Door is locked for this event."}
                  </CardContent>
                </Card>
              )}
            </div>
            <Card className="glass h-fit rounded-lg">
              <CardHeader>
                <CardTitle>Invite controller</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={inviteOrganizerController} className="grid gap-4">
                  <input type="hidden" name="event_id" value={event.id} />
                  <div className="grid gap-2">
                    <Label htmlFor="controller-email">Email</Label>
                    <Input
                      id="controller-email"
                      name="email"
                      type="email"
                      required
                      disabled={!doorEligible}
                    />
                  </div>
                  <Button type="submit" disabled={!doorEligible}>
                    <Send className="h-4 w-4" />
                    Invite
                  </Button>
                  {!doorEligible ? (
                    <p className="text-xs text-muted-foreground">
                      Publish the event and generate tickets before inviting
                      door staff.
                    </p>
                  ) : null}
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
