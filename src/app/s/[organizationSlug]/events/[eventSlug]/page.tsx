import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import {
  getPublishedEventByOrganizationSlug,
  listPublicEventCategories,
} from "@/lib/events/public";
import {
  getActiveOrganizationBySlug,
  organizationEventPath,
} from "@/lib/organizations/public";
import { storefrontPathForHost } from "@/lib/organizations/hosts";

export default async function OrganizationEventPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}) {
  const [{ organizationSlug, eventSlug }, profile, headerStore] = await Promise.all([
    params,
    getCurrentProfile(),
    headers(),
  ]);
  redirectIfCannotUseBuyerSurface(profile);

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
          ? storefrontPathForHost(
              organization.slug,
              organizationEventPath(organization.slug, event.slug),
              `/events/${event.slug}`,
              headerStore.get("host"),
            )
          : undefined
      }
    />
  );
}
