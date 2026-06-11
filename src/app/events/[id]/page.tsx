import { notFound } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { getPublishedEventById, listPublicEventCategories } from "@/lib/events/public";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, getCurrentProfile()]);
  redirectIfCannotUseBuyerSurface(profile);

  const event = await getPublishedEventById(id);
  if (!event) notFound();

  const categories = await listPublicEventCategories(event.id);
  return <EventDetail event={event} categories={categories} />;
}
