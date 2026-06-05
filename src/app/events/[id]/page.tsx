import { notFound, redirect } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile } from "@/lib/auth";
import { getPublishedEventById, listPublicEventCategories } from "@/lib/events/public";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, profile] = await Promise.all([params, getCurrentProfile()]);
  if (profile?.role === "controller") redirect("/controller");

  const event = await getPublishedEventById(id);
  if (!event) notFound();

  const categories = await listPublicEventCategories(event.id);
  return <EventDetail event={event} categories={categories} />;
}
