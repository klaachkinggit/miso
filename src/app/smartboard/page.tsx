import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarPlus, ExternalLink, LockKeyhole, Megaphone, Settings, ShieldCheck, Tag, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmbedSnippet } from "@/components/smartboard/embed-snippet";
import { ThemePicker } from "@/components/smartboard/theme-picker";
import { ResaleCapSettings } from "@/components/smartboard/resale-cap-settings";
import { CustomDomainSettings } from "@/components/smartboard/custom-domain-settings";
import { getTheme, type ThemeKey } from "@/lib/organizations/theme";
import { resolveResaleCapBps } from "@/lib/resale/caps";
import { requireRole } from "@/lib/auth";
import { buildEmbedSnippet } from "@/lib/embed/snippet";
import { formatDateShort } from "@/lib/format";
import {
  getOrganizerCompliance,
  refreshOrganizerLiveStatus,
  slugify,
} from "@/lib/organizers/profile";
import { getActiveAdminOrganization } from "@/lib/organizations/context";
import { listPromoCodes } from "@/lib/promo";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPrice } from "@/lib/format";
import type { EventRow, PromoCode, Ticket } from "@/types/db";
import {
  createOrganizerEvent,
  createPromoCodeAction,
  deactivatePromoCodeAction,
  getActiveOrganizationFollowerCount,
  saveLegalCompliance,
  saveOrganizerPage,
  sendAnnouncementAction,
  startStripeConnect,
} from "./actions";

const TAB_VALUES = ["events", "marketing", "promos", "analyse", "banking", "page"] as const;

export default async function SmartboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; tab?: string; announced?: string }>;
}) {
  const profile = await requireRole("organizer");
  await refreshOrganizerLiveStatus(profile.id);
  const params = await searchParams;
  const activeTab = TAB_VALUES.includes(params?.tab as (typeof TAB_VALUES)[number])
    ? (params?.tab as (typeof TAB_VALUES)[number])
    : "events";
  const compliance = await getOrganizerCompliance(profile.id);
  if (!compliance.organizer) redirect("/onboarding");

  const sb = createServiceClient();
  const { data: events } = await sb
    .from("events")
    .select("*")
    .eq("organizer_user_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<EventRow[]>();
  const eventRows = events ?? [];
  const eventIds = eventRows.map((event) => event.id);
  const { data: tickets } = eventIds.length
    ? await sb
        .from("tickets")
        .select("id, event_id, status")
        .in("event_id", eventIds)
        .returns<Pick<Ticket, "id" | "event_id" | "status">[]>()
    : { data: [] as Pick<Ticket, "id" | "event_id" | "status">[] };
  const ticketRows = tickets ?? [];
  const soldCount = ticketRows.filter((ticket) => ["sold", "listed", "used"].includes(ticket.status)).length;
  const generatedCount = ticketRows.length;
  const followerCount = await getActiveOrganizationFollowerCount(profile);
  const announcedCount = params?.announced ? Number(params.announced) : null;
  const { activeOrganization } = await getActiveAdminOrganization(profile);
  const promoCodes = activeOrganization
    ? await listPromoCodes(activeOrganization.id)
    : [];

  // Org self-serve settings (P1.5 theme / P1.7 resale cap / P1.8 custom domain).
  const orgSettings = activeOrganization
    ? (
        await sb
          .from("organizations")
          .select(
            "theme, resale_cap_bps, country_code, custom_domain, custom_domain_verified_at, custom_domain_verification_token",
          )
          .eq("id", activeOrganization.id)
          .maybeSingle<{
            theme: unknown;
            resale_cap_bps: number;
            country_code: string | null;
            custom_domain: string | null;
            custom_domain_verified_at: string | null;
            custom_domain_verification_token: string | null;
          }>()
      ).data
    : null;
  const effectiveCapBps = activeOrganization
    ? await resolveResaleCapBps({ organizationId: activeOrganization.id })
    : 0;
  const countryOverride =
    effectiveCapBps !== (orgSettings?.resale_cap_bps ?? 0);

  const publishedEventIds = eventRows
    .filter((event) => event.status === "published")
    .map((event) => event.id);
  const { data: embedCategories } = publishedEventIds.length
    ? await sb
        .from("ticket_categories")
        .select("id, name, event_id")
        .in("event_id", publishedEventIds)
        .order("price", { ascending: true })
    : { data: [] as Array<{ id: string; name: string; event_id: string }> };
  const appOrigin = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3002"
  ).replace(/\/+$/, "");

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="mono-stub mb-3 text-primary">Organizer Smartboard</p>
          <h1 className="text-3xl font-semibold">{compliance.organizer.page_name ?? profile.display_name ?? profile.email}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {compliance.live ? "Live account" : "Sandbox account"} · {eventRows.length} events · {generatedCount} tickets generated
          </p>
        </div>
        <Badge variant={compliance.live ? "success" : "warning"}>
          {compliance.live ? "Live" : "Sandbox"}
        </Badge>
      </div>

      {params?.error ? (
        <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {params.error}
        </div>
      ) : null}

      {!compliance.live ? (
        <ComplianceBanner
          legalReady={compliance.legalReady}
          stripeReady={compliance.stripeReady}
          siret={compliance.organizer.siret}
          noSiret={compliance.organizer.no_siret}
        />
      ) : null}

      <Tabs defaultValue={activeTab}>
        <TabsList className="mt-6 flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="events">Evenements</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="promos">Promos</TabsTrigger>
          <TabsTrigger value="analyse">Analyse</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="page">Ma Page</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <section className="grid gap-4">
              {eventRows.length ? (
                eventRows.map((event) => {
                  const count = ticketRows.filter((ticket) => ticket.event_id === event.id).length;
                  return (
                    <Card key={event.id} className="glass rounded-lg">
                      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-semibold">{event.name}</h2>
                            <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
                            {event.status === "draft" && !compliance.live ? (
                              <Badge variant="warning">Publish locked</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateShort(event.date)} · {event.venue_name}, {event.city} · {count} tickets
                          </p>
                        </div>
                        <Button asChild variant="outline">
                          <Link href={`/smartboard/events/${event.id}`}>
                            <Settings className="h-4 w-4" />
                            Manage
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="glass rounded-lg">
                  <CardContent className="p-5 text-sm text-muted-foreground">No organizer events yet.</CardContent>
                </Card>
              )}
            </section>
            <CreateEventCard />
          </div>
        </TabsContent>

        <TabsContent value="marketing">
          <div className="grid gap-5 md:grid-cols-3">
            <MetricCard icon={CalendarPlus} label="Draft events" value={eventRows.filter((event) => event.status === "draft").length} />
            <MetricCard icon={ShieldCheck} label="Published events" value={eventRows.filter((event) => event.status === "published").length} />
            <MetricCard icon={Users} label="Followers" value={followerCount} />
          </div>
          <div className="mt-5">
            <AnnounceComposer followerCount={followerCount} announcedCount={announcedCount} />
          </div>
        </TabsContent>

        <TabsContent value="promos">
          {activeOrganization ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              <PromoCodeList promoCodes={promoCodes} />
              <CreatePromoCard />
            </div>
          ) : (
            <Card className="glass rounded-lg">
              <CardContent className="p-5 text-sm text-muted-foreground">
                Set up your organization before creating promo codes.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analyse">
          <div className="grid gap-5 md:grid-cols-3">
            <MetricCard icon={BarChart3} label="Generated tickets" value={generatedCount} />
            <MetricCard icon={WalletCards} label="Primary sales" value={soldCount} />
            <MetricCard icon={LockKeyhole} label="Sandbox locks" value={compliance.live ? 0 : 1} />
          </div>
        </TabsContent>

        <TabsContent value="banking">
          <div className="grid gap-5 lg:grid-cols-2">
            <BankingCard
              legalReady={compliance.legalReady}
              stripeReady={compliance.stripeReady}
              siret={compliance.organizer.siret}
              noSiret={compliance.organizer.no_siret}
            />
            <Card className="glass rounded-lg">
              <CardHeader>
                <CardTitle>Stripe Connect</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between rounded-md border border-border/70 p-3">
                  <span>Payout readiness</span>
                  <Badge variant={compliance.stripeReady ? "success" : "warning"}>
                    {compliance.stripeReady ? "Verified" : "Required"}
                  </Badge>
                </div>
                <form action={startStripeConnect}>
                  <Button type="submit" className="w-full">
                    <ExternalLink className="h-4 w-4" />
                    Open Stripe onboarding
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="page">
          <EmbedWidgetCard
            origin={appOrigin}
            events={eventRows.filter((event) => event.status === "published")}
            categories={embedCategories ?? []}
          />
          {activeOrganization ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <Card className="glass rounded-lg">
                <CardHeader>
                  <CardTitle>Storefront theme</CardTitle>
                </CardHeader>
                <CardContent>
                  <ThemePicker currentKey={getTheme(orgSettings?.theme).key as ThemeKey} />
                </CardContent>
              </Card>
              <Card className="glass rounded-lg">
                <CardHeader>
                  <CardTitle>Resale price cap</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResaleCapSettings
                    orgCapBps={orgSettings?.resale_cap_bps ?? 0}
                    effectiveCapBps={effectiveCapBps}
                    countryCode={orgSettings?.country_code ?? null}
                    countryOverride={countryOverride}
                  />
                </CardContent>
              </Card>
              <Card className="glass rounded-lg">
                <CardHeader>
                  <CardTitle>Custom domain</CardTitle>
                </CardHeader>
                <CardContent>
                  <CustomDomainSettings
                    customDomain={orgSettings?.custom_domain ?? null}
                    verified={Boolean(orgSettings?.custom_domain_verified_at)}
                    verificationToken={orgSettings?.custom_domain_verification_token ?? null}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
            <Card className="glass rounded-lg">
              <CardHeader>
                <CardTitle>Organizer page</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={saveOrganizerPage} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="page_name">Page name</Label>
                    <Input id="page_name" name="page_name" defaultValue={compliance.organizer.page_name ?? ""} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="page_slug">Slug</Label>
                    <Input
                      id="page_slug"
                      name="page_slug"
                      defaultValue={compliance.organizer.page_slug ?? slugify(compliance.organizer.page_name ?? profile.email)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="page_description">Description</Label>
                    <Textarea id="page_description" name="page_description" rows={4} defaultValue={compliance.organizer.page_description ?? ""} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="widget_accent_color">Widget accent</Label>
                    <Input id="widget_accent_color" name="widget_accent_color" type="color" defaultValue={compliance.organizer.widget_accent_color} />
                  </div>
                  <Button type="submit">Save page</Button>
                </form>
              </CardContent>
            </Card>
            <Card className="glass h-fit rounded-lg">
              <CardHeader>
                <CardTitle>Xpress Door</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <p>Controller invitations are available inside published events with generated tickets.</p>
                {eventRows.filter((event) => event.status === "published").length ? (
                  <div className="grid gap-2">
                    {eventRows.filter((event) => event.status === "published").map((event) => (
                      <Button key={event.id} asChild variant="outline">
                        <Link href={`/smartboard/events/${event.id}?tab=door`}>{event.name}</Link>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Badge variant="warning">Locked</Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComplianceBanner({
  legalReady,
  stripeReady,
  siret,
  noSiret,
}: {
  legalReady: boolean;
  stripeReady: boolean;
  siret: string | null;
  noSiret: boolean;
}) {
  return (
    <Card className="sticky top-16 z-30 mb-6 rounded-lg border-amber-500/40 bg-amber-500/10">
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Publishing is locked until compliance is complete.</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={legalReady ? "success" : "warning"}>Legal identity {legalReady ? "ready" : "required"}</Badge>
            <Badge variant={stripeReady ? "success" : "warning"}>Stripe {stripeReady ? "verified" : "required"}</Badge>
          </div>
        </div>
        <form action={saveLegalCompliance} className="grid gap-2">
          <Label htmlFor="siret-banner">SIRET or corporate id</Label>
          <div className="flex gap-2">
            <Input id="siret-banner" name="siret" defaultValue={siret ?? ""} disabled={noSiret} />
            <Button type="submit" variant="outline">Save</Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input name="no_siret" type="checkbox" defaultChecked={noSiret} className="h-4 w-4" />
            I do not have one
          </label>
        </form>
      </CardContent>
    </Card>
  );
}

function BankingCard({
  legalReady,
  stripeReady,
  siret,
  noSiret,
}: {
  legalReady: boolean;
  stripeReady: boolean;
  siret: string | null;
  noSiret: boolean;
}) {
  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle>Legal identity</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveLegalCompliance} className="grid gap-4">
          <div className="flex items-center justify-between rounded-md border border-border/70 p-3 text-sm">
            <span>SIRET / corporate id</span>
            <Badge variant={legalReady ? "success" : "warning"}>{legalReady ? "Saved" : "Required"}</Badge>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="siret">SIRET or regional equivalent</Label>
            <Input id="siret" name="siret" defaultValue={siret ?? ""} disabled={noSiret} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input name="no_siret" type="checkbox" defaultChecked={noSiret} className="h-4 w-4" />
            I do not have one
          </label>
          <Button type="submit">Save legal identity</Button>
          <p className="text-xs text-muted-foreground">
            Stripe status: {stripeReady ? "ready for payouts" : "verification pending"}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateEventCard() {
  return (
    <Card className="glass h-fit rounded-lg">
      <CardHeader>
        <CardTitle>Create draft event</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createOrganizerEvent} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="datetime-local" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" min="1" required />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="venue_name">Venue</Label>
              <Input id="venue_name" name="venue_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image_url">Image URL</Label>
            <Input id="image_url" name="image_url" type="url" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="organizer_resale_royalty_pct">Resale royalty (%)</Label>
            <Input id="organizer_resale_royalty_pct" name="organizer_resale_royalty_pct" type="number" step="0.5" min="0" max="50" defaultValue="0" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <input type="hidden" name="resale_enabled" value="true" />
          <input type="hidden" name="sales_enabled" value="true" />
          <Button type="submit">Create draft</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AnnounceComposer({
  followerCount,
  announcedCount,
}: {
  followerCount: number;
  announcedCount: number | null;
}) {
  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Announce to followers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {announcedCount !== null ? (
          <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
            Announcement sent to {announcedCount} {announcedCount === 1 ? "follower" : "followers"}.
          </div>
        ) : null}
        <form action={sendAnnouncementAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="announce_subject">Subject</Label>
            <Input id="announce_subject" name="subject" maxLength={150} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="announce_body">Message</Label>
            <Textarea id="announce_body" name="body" rows={6} required />
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Reaches {followerCount} active {followerCount === 1 ? "follower" : "followers"}.
            </p>
            <Button type="submit" disabled={followerCount === 0}>
              Send announcement
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PromoCodeList({ promoCodes }: { promoCodes: PromoCode[] }) {
  return (
    <Card className="glass rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Promo codes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {promoCodes.length ? (
          <div className="overflow-hidden rounded-md border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Discount</th>
                  <th className="px-3 py-2">Used</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((promo) => (
                  <tr key={promo.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-mono">{promo.code}</td>
                    <td className="px-3 py-2">
                      {promo.discount_kind === "percent"
                        ? `${promo.percent_off}%`
                        : formatPrice((promo.amount_off_cents ?? 0) / 100, "EUR")}
                    </td>
                    <td className="px-3 py-2">
                      {promo.used_count}
                      {promo.max_uses != null ? ` / ${promo.max_uses}` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={promo.active ? "success" : "secondary"}>
                        {promo.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {promo.active ? (
                        <form action={deactivatePromoCodeAction}>
                          <input type="hidden" name="promo_code_id" value={promo.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Deactivate
                          </Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No promo codes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CreatePromoCard() {
  return (
    <Card className="glass h-fit rounded-lg">
      <CardHeader>
        <CardTitle>Create promo code</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createPromoCodeAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="promo_code_input">Code</Label>
            <Input id="promo_code_input" name="code" placeholder="EARLYBIRD" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="discount_kind">Discount type</Label>
            <select
              id="discount_kind"
              name="discount_kind"
              className="h-10 rounded-md border border-border/70 bg-background px-3 text-sm"
              defaultValue="percent"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount (EUR)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="percent_off">Percent off</Label>
              <Input id="percent_off" name="percent_off" type="number" min="1" max="100" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount_off">Fixed (EUR)</Label>
              <Input id="amount_off" name="amount_off" type="number" min="0.01" step="0.01" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="max_uses">Max uses (optional)</Label>
            <Input id="max_uses" name="max_uses" type="number" min="1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="starts_at">Starts</Label>
              <Input id="starts_at" name="starts_at" type="datetime-local" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ends_at">Ends</Label>
              <Input id="ends_at" name="ends_at" type="datetime-local" />
            </div>
          </div>
          <Button type="submit">Create promo code</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EmbedWidgetCard({
  origin,
  events,
  categories,
}: {
  origin: string;
  events: EventRow[];
  categories: Array<{ id: string; name: string; event_id: string }>;
}) {
  const eventsWithCategories = events.filter((event) =>
    categories.some((category) => category.event_id === event.id),
  );
  return (
    <Card className="glass mb-5 rounded-lg">
      <CardHeader>
        <CardTitle>Embed widget</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm text-muted-foreground">
        <p>
          Paste a category snippet on any external site to embed a checkout button. Buyers complete
          payment back on MISO.
        </p>
        {eventsWithCategories.length ? (
          eventsWithCategories.map((event) => (
            <div key={event.id} className="grid gap-2">
              <p className="font-medium text-foreground">{event.name}</p>
              {categories
                .filter((category) => category.event_id === event.id)
                .map((category) => (
                  <div key={category.id} className="grid gap-1">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                      {category.name}
                    </p>
                    <EmbedSnippet snippet={buildEmbedSnippet(origin, category.id)} />
                  </div>
                ))}
            </div>
          ))
        ) : (
          <p>Publish an event with ticket categories to generate an embed snippet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card className="glass rounded-lg">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
