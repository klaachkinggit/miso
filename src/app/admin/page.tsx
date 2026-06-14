import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarPlus,
  CheckCircle2,
  CircleDollarSign,
  Settings,
  Images,
  TicketCheck,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopilotPanel } from "@/components/ai/copilot-panel";
import { EmptyState } from "@/components/site/empty-state";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { loadOrganizerOverview } from "@/lib/analytics/organizer";
import { formatDateShort, formatPrice } from "@/lib/format";
import { getActiveAdminOrganization } from "@/lib/organizations/context";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function OrganizerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const [params, profile] = await Promise.all([searchParams, requireOrganizerWorkspace()]);
  const { organizations, activeOrganization } = await getActiveAdminOrganization(profile);

  if (!organizations.length) {
    return (
      <div className="container py-24">
        <div className="mx-auto max-w-xl text-center">
          <p className="eyebrow-signal">No workspace yet</p>
          <h1 className="display mt-5 text-4xl text-foreground md:text-5xl">
            Create your<br />
            <span className="display-italic" style={{ color: "hsl(var(--signal))" }}>
              organization.
            </span>
          </h1>
          <p className="mt-5 text-muted-foreground">
            Your ticketing workspace — events, team, payouts, and your public storefront all live
            inside it.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link href="/admin/organizations/new">
                <Building2 className="h-4 w-4" /> Create organization
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { totals, events } = await loadOrganizerOverview({
    profile,
    organizationId: activeOrganization?.id ?? null,
  });
  const canCreateEvent =
    !!activeOrganization?.stripe_charges_enabled && !!activeOrganization.stripe_details_submitted;

  return (
    <div className="container py-10">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow-signal">
            {activeOrganization?.name ?? "Organizer workspace"}
          </p>
          <h1 className="display mt-3 text-4xl text-foreground md:text-5xl">Workspace.</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Sales, revenue, and door attendance across every event you run on MISO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/events">
              <Settings className="h-4 w-4" /> Manage events
            </Link>
          </Button>
          {profile.role === "admin" ? (
            <Button asChild variant="outline">
              <Link href="/admin/site">
                <Images className="h-4 w-4" /> Landing media
              </Link>
            </Button>
          ) : null}
          {canCreateEvent ? (
            <Button asChild>
              <Link href="/admin/events/new">
                <CalendarPlus className="h-4 w-4" /> New event
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/admin/settings">
                <CircleDollarSign className="h-4 w-4" /> Finish Stripe onboarding
              </Link>
            </Button>
          )}
        </div>
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

      <div className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={CircleDollarSign}
          label="Revenue (paid)"
          value={formatPrice(totals.revenue_paid, totals.currency)}
          hint={`${totals.tickets_sold} tickets · ${totals.published_events} live events`}
        />
        <KpiCard
          icon={TicketCheck}
          label="Tickets sold"
          value={`${totals.tickets_sold}`}
          hint={
            totals.total_capacity > 0
              ? `${percent(totals.tickets_sold / totals.total_capacity)} of capacity`
              : "Capacity not set"
          }
        />
        <KpiCard
          icon={CheckCircle2}
          label="Door redemptions"
          value={`${totals.tickets_redeemed}`}
          hint={
            totals.tickets_sold > 0
              ? `${percent(totals.tickets_redeemed / totals.tickets_sold)} attendance`
              : "No sold tickets yet"
          }
        />
        <KpiCard
          icon={BarChart3}
          label="Events"
          value={`${totals.total_events}`}
          hint={`${totals.published_events} published · ${totals.draft_events} draft`}
        />
      </div>

      <div className="mt-12">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="eyebrow">Per-event performance</p>
            <h2 className="display mt-2 text-2xl text-foreground md:text-3xl">Live ledger.</h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/events">All events →</Link>
          </Button>
        </div>
        {events.length ? (
          <ol className="space-y-px overflow-hidden rounded-md border border-hairline bg-hairline">
            {events.map((event) => (
              <li
                key={event.event_id}
                className="grid gap-4 bg-ink-raised p-5 transition-colors hover:bg-ink-soft md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center"
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{event.name}</h3>
                    <Badge variant={event.status === "published" ? "signal" : "secondary"}>
                      {event.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(event.date)} · {event.venue_name}, {event.city}
                  </p>
                </div>
                <Stat
                  label="Sold"
                  value={`${event.tickets_sold} / ${event.capacity}`}
                  hint={`${percent(event.sellout_rate)} sellout`}
                />
                <Stat
                  label="Revenue"
                  value={formatPrice(event.revenue_paid, event.currency)}
                  hint={
                    event.tickets_sold > 0
                      ? `${formatPrice(event.revenue_paid / event.tickets_sold, event.currency)} avg`
                      : "—"
                  }
                />
                <Stat
                  label="Attendance"
                  value={`${event.tickets_redeemed}`}
                  hint={event.tickets_sold > 0 ? percent(event.attendance_rate) : "—"}
                  icon={TrendingUp}
                />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/events/${event.event_id}`}>Manage</Link>
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title="No events yet"
            description="Create your first event to start tracking sales and attendance here."
          >
            <Button asChild>
              <Link href="/admin/events/new">Create event</Link>
            </Button>
          </EmptyState>
        )}
      </div>

      {activeOrganization ? <CopilotPanel organizationId={activeOrganization.id} /> : null}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 bg-ink-raised p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-ink text-signal">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <p className="display mt-2 text-2xl text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p className="mt-1.5 font-medium text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
