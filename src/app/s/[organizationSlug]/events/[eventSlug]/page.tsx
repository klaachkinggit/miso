import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EventDetail } from "@/components/site/event-detail";
import { getCurrentProfile, redirectIfCannotUseBuyerSurface } from "@/lib/auth";
import { eventImage } from "@/lib/events/images";
import {
  getPublishedEventByOrganizationSlug,
  listPublicEventCategories,
} from "@/lib/events/public";
import { formatDate } from "@/lib/format";
import {
  getActiveOrganizationBySlug,
  organizationEventPath,
} from "@/lib/organizations/public";
import { storefrontPathForHost } from "@/lib/organizations/hosts";
import { getConfiguredAppUrl } from "@/lib/url";
import { isOnWaitlist } from "@/lib/waitlist";

const appUrl = getConfiguredAppUrl();

export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { organizationSlug, eventSlug } = await params;

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) return { title: "Event — MISO", robots: { index: false } };

  const event = await getPublishedEventByOrganizationSlug({
    organizationId: organization.id,
    eventSlug,
  });
  if (!event || event.status !== "published") {
    return { title: "Event — MISO", robots: { index: false } };
  }

  const description = [
    event.description,
    `${event.venue_name}, ${event.city}`,
    formatDate(event.date),
  ]
    .filter(Boolean)
    .join(" · ");

  const image = eventImage(event, "hero") ?? eventImage(event, "thumbnail");
  const url = `${appUrl}/s/${organizationSlug}/events/${eventSlug}`;

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

export default async function OrganizationEventPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string }>;
}) {
  const [{ organizationSlug, eventSlug }, profile, headerStore] =
    await Promise.all([params, getCurrentProfile(), headers()]);
  redirectIfCannotUseBuyerSurface(profile);

  const organization = await getActiveOrganizationBySlug(organizationSlug);
  if (!organization) notFound();

  const event = await getPublishedEventByOrganizationSlug({
    organizationId: organization.id,
    eventSlug,
  });
  if (!event) notFound();

  const categories = await listPublicEventCategories(event.id);
  const onWaitlist = profile
    ? await isOnWaitlist({ eventId: event.id, userId: profile.id })
    : false;
  return (
    <EventDetail
      event={event}
      categories={categories}
      calendarHref={`/api/events/${event.id}/calendar`}
      isOnWaitlist={onWaitlist}
      waitlistPath={organizationEventPath(organization.slug, eventSlug)}
      organizationSlug={organization.slug}
      eventSlug={eventSlug}
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
