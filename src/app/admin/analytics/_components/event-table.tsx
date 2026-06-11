import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AnalyticsEventStat } from "@/lib/analytics/organization";
import { formatDateShort, formatPrice } from "@/lib/format";

interface EventTableProps {
  events: AnalyticsEventStat[];
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function EventTable({ events }: EventTableProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No events match the current filters.</p>
    );
  }
  return (
    <ol className="space-y-px overflow-hidden rounded-md border border-hairline bg-hairline">
      {events.map((event) => (
        <li
          key={event.event_id}
          className="grid gap-4 bg-ink-raised p-5 transition-colors hover:bg-ink-soft md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] md:items-center"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{event.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateShort(event.date)} · {event.city || event.venue_name || "—"}
            </p>
          </div>
          <Metric label="Revenue" value={formatPrice(event.revenue_paid, event.currency)} />
          <Metric label="Sold" value={`${event.tickets_sold}/${event.capacity}`} hint={percent(event.sellout_rate)} />
          <Metric label="Attendance" value={percent(event.attendance_rate)} hint={`${event.tickets_redeemed} redeemed`} />
          <Link
            href={`/admin/events/${event.event_id}`}
            className="inline-flex items-center gap-1 text-sm text-signal hover:text-foreground"
          >
            Detail <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
