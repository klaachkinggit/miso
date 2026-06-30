import "server-only";

import {
  getPublishedEventById,
  type PublicEventCategory,
} from "@/lib/events/public";
import { createServiceClient } from "@/lib/supabase/service";
import type { EventRow, TicketCategory } from "@/types/db";

export type EmbedCategory = {
  category: PublicEventCategory;
  event: EventRow;
};

/** Load a single category plus its published event for the embed widget. Null when the category is missing or its event is unpublished. */
export async function getEmbedCategory(
  categoryId: string,
): Promise<EmbedCategory | null> {
  const sb = createServiceClient();
  const { data: category, error } = await sb
    .from("ticket_categories")
    .select("*")
    .eq("id", categoryId)
    .maybeSingle<TicketCategory>();
  if (error) throw new Error(`Embed category lookup failed: ${error.message}`);
  if (!category) return null;

  const event = await getPublishedEventById(category.event_id);
  if (!event) return null;

  return {
    category: {
      ...category,
      remaining: Math.max(0, category.supply - category.sold_count),
    },
    event,
  };
}
