import type { EventRow } from "@/types/db";

export type EventImageKind = "thumbnail" | "hero" | "ticket" | "marketplace";

type EventImageInput = Partial<
  Pick<
    EventRow,
    "thumbnail_url" | "hero_url" | "ticket_visual_url" | "marketplace_url" | "image_url"
  >
>;

export function eventImage(event: EventImageInput | null | undefined, kind: EventImageKind): string | null {
  if (!event) return null;
  const primary =
    kind === "thumbnail"
      ? event.thumbnail_url
      : kind === "hero"
        ? event.hero_url
        : kind === "ticket"
          ? event.ticket_visual_url
          : event.marketplace_url;
  return primary ?? event.image_url ?? null;
}
