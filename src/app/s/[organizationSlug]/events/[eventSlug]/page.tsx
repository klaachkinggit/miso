import { notFound, redirect } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile } from "@/lib/auth";
import {
  getPublishedEventByOrganizationSlug,
  listPublicEventCategories,
} from "@/lib/events/public";
import {
  getActiveOrganizationBySlug,
  organizationEventPath,
} from "@/lib/organizations/public";

export default async function OrganizationEventPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}) {
  const [{ organizationSlug, eventSlug }, profile] = await Promise.all([
    params,
    getCurrentProfile(),
  ]);
  if (profile?.role === "controller") redirect("/controller");

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const event = await getPublishedEventByOrganizationSlug({
    organizationId: organization.id,
    eventSlug,
  });
  if (!event) notFound();

  const categories = await listPublicEventCategories(event.id);
  return (
    <EventDetail
      event={event}
      categories={categories}
      returnPath={
        event.slug
          ? organizationEventPath(organization.slug, event.slug)
          : undefined
      }
    />
  );
}
