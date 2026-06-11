import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
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

  const url = `${appUrl}/events/${event.id}`;

  return {
    title: `${event.name} — MISO`,
    description,
    openGraph: {
      title: `${event.name} — MISO`,
      description,
      url,
      // openGraph.images intentionally omitted — file-convention opengraph-image.tsx wins
    },
    twitter: {
      card: "summary_large_image",
      title: `${event.name} — MISO`,
      description,
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, getCurrentProfile()]);
  redirectIfCannotUseBuyerSurface(profile);

  const event = await getPublishedEventById(id);
  if (!event) notFound();

  const categories = await listPublicEventCategories(event.id);

  const lowestCategory = categories.length > 0
    ? categories.reduce((min, c) => (c.price < min.price ? c : min), categories[0])
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate: event.date,
    location: {
      "@type": "Place",
      name: event.venue_name,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city,
      },
    },
    ...(event.description ? { description: event.description } : {}),
    url: `${appUrl}/events/${event.id}`,
    ...(lowestCategory
      ? {
          offers: {
            "@type": "Offer",
            price: lowestCategory.price,
            priceCurrency: lowestCategory.currency,
            availability:
              lowestCategory.remaining > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
          },
        }
      : {}),
  };

  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />
      <EventDetail event={event} categories={categories} calendarHref={`/api/events/${id}/calendar`} />
    </>
  );
}
