import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { eventImage } from "@/lib/events/images";
import { getPublishedEventById, listPublicEventCategories } from "@/lib/events/public";
import { formatDate } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow } from "@/types/db";

const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3002"
).replace(/\/+$/, "");

async function getEventById(id: string): Promise<EventRow | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle<EventRow>();
  return data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event || event.status !== "published") {
    return {
      title: "Event — MISO",
      robots: { index: false },
    };
  }

  const description = [
    event.description,
    `${event.venue_name}, ${event.city}`,
    formatDate(event.date),
  ]
    .filter(Boolean)
    .join(" · ");

  const image = eventImage(event, "hero") ?? eventImage(event, "thumbnail");
  const url = `${appUrl}/events/${event.id}`;

  return {
    title: `${event.name} — MISO`,
    description,
    openGraph: {
      title: `${event.name} — MISO`,
      description,
      url,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${event.name} — MISO`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, getCurrentProfile()]);
  redirectIfCannotUseBuyerSurface(profile);

  const event = await getPublishedEventById(id);
  if (!event) notFound();

  const categories = await listPublicEventCategories(event.id);
  return <EventDetail event={event} categories={categories} calendarHref={`/api/events/${id}/calendar`} />;
}
