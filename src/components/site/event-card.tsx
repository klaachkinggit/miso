import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateShort } from "@/lib/format";
import type { EventRow } from "@/types/db";

export function EventCard({
  event,
  categoryCount,
}: {
  event: EventRow;
  categoryCount?: number;
}) {
  return (
    <Card className="glass group overflow-hidden rounded-lg transition-transform hover:-translate-y-0.5">
      <Link href={`/events/${event.id}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
          {event.image_url ? (
            <Image
              src={event.image_url}
              alt={event.name}
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(270_95%_70%/.3),transparent_35%),linear-gradient(135deg,hsl(240_10%_10%),hsl(220_40%_12%))]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
          <Badge className="absolute left-4 top-4" variant={event.status === "published" ? "success" : "secondary"}>
            {event.status}
          </Badge>
        </div>
      </Link>
      <CardContent className="space-y-4 p-5">
        <div>
          <Link href={`/events/${event.id}`} className="text-xl font-semibold hover:text-primary">
            {event.name}
          </Link>
          {event.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>
          ) : null}
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {formatDateShort(event.date)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {event.venue_name}, {event.city}
          </span>
          {typeof categoryCount === "number" ? (
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              {categoryCount} ticket {categoryCount === 1 ? "category" : "categories"}
            </span>
          ) : null}
        </div>
        <Button asChild className="w-full">
          <Link href={`/events/${event.id}`}>View tickets</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
