import Link from "next/link";
import {
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  Settings,
  Images,
  TicketCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/site/empty-state";
import { requireOrganizerWorkspace } from "@/lib/auth";
import { loadOrganizerOverview } from "@/lib/analytics/organizer";
import { formatDateShort, formatPrice } from "@/lib/format";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default async function OrganizerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>;
}) {
  const [params, profile] = await Promise.all([searchParams, requireOrganizerWorkspace()]);
  const { totals, events } = await loadOrganizerOverview({ profile });

  return (
    <div className="container py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-stub text-[#E6D8C9]/55">Organizer workspace</p>
          <h1 className="display mt-2 text-3xl md:text-4xl">Analytics dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Track ticket sales, revenue and door attendance across every event you run on MISO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/events">
              <Settings className="h-4 w-4" /> Manage events
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/site">
              <Images className="h-4 w-4" /> Landing media
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/events/new">
              <CalendarPlus className="h-4 w-4" /> New event
            </Link>
          </Button>
        </div>
      </div>

      {params?.error ? (
        <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </div>
      ) : null}
      {params?.success ? (
        <div className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          {params.success}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
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

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Per-event performance</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/events">All events →</Link>
          </Button>
        </div>
        {events.length ? (
          <div className="grid gap-3">
            {events.map((event) => (
              <Card key={event.event_id} className="glass rounded-lg">
                <CardContent className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-center">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{event.name}</h3>
                      <Badge variant={event.status === "published" ? "success" : "secondary"}>{event.status}</Badge>
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
                    hint={event.tickets_sold > 0 ? `${formatPrice(event.revenue_paid / event.tickets_sold, event.currency)} avg` : "—"}
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
                </CardContent>
              </Card>
            ))}
          </div>
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
    <Card className="glass rounded-lg">
      <CardContent className="flex flex-col gap-3 p-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
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
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
