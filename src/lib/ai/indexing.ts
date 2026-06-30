import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  embedTexts,
  embeddingsEnabled,
  toVectorLiteral,
} from "@/lib/ai/embeddings";

const MAX_CHUNKS = 200;

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  date: string;
  venue_name: string;
  city: string;
  genre: string | null;
  vibe: string | null;
  artists: string[];
};

type CategoryRow = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  price: number;
  currency: string;
};

type Chunk = {
  sourceType: "event" | "category";
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
};

function eventChunk(event: EventRow, categories: CategoryRow[]): Chunk {
  const tiers = categories
    .map((c) => `${c.name}: ${c.price} ${c.currency}`)
    .join(", ");
  const lines = [
    `Event: ${event.name}`,
    event.description ? `Description: ${event.description}` : null,
    `Date: ${event.date}`,
    `Venue: ${event.venue_name}, ${event.city}`,
    event.genre ? `Genre: ${event.genre}` : null,
    event.vibe ? `Vibe: ${event.vibe}` : null,
    event.artists.length > 0 ? `Artists: ${event.artists.join(", ")}` : null,
    tiers ? `Tickets: ${tiers}` : null,
  ].filter(Boolean);
  return {
    sourceType: "event",
    sourceId: event.id,
    content: lines.join("\n"),
    metadata: { name: event.name, date: event.date, city: event.city },
  };
}

function categoryChunk(category: CategoryRow, eventName: string): Chunk {
  const lines = [
    `Ticket tier: ${category.name} (for ${eventName})`,
    `Price: ${category.price} ${category.currency}`,
    category.description ? `Description: ${category.description}` : null,
    category.benefits ? `Benefits: ${category.benefits}` : null,
  ].filter(Boolean);
  return {
    sourceType: "category",
    sourceId: category.id,
    content: lines.join("\n"),
    metadata: {
      name: category.name,
      price: category.price,
      currency: category.currency,
    },
  };
}

export async function reindexOrganization(
  organizationId: string,
): Promise<{ indexed: number }> {
  if (!embeddingsEnabled()) return { indexed: 0 };

  const supabase = createServiceClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, name, description, date, venue_name, city, genre, vibe, artists",
    )
    .eq("organization_id", organizationId)
    .eq("status", "published");

  if (!events || events.length === 0) return { indexed: 0 };

  const eventIds = events.map((e) => e.id);
  const { data: categories } = await supabase
    .from("ticket_categories")
    .select("id, event_id, name, description, benefits, price, currency")
    .in("event_id", eventIds);

  const cats = (categories ?? []) as CategoryRow[];
  const eventNames = new Map(events.map((e) => [e.id, e.name]));
  const catsByEvent = new Map<string, CategoryRow[]>();
  for (const c of cats) {
    const list = catsByEvent.get(c.event_id) ?? [];
    list.push(c);
    catsByEvent.set(c.event_id, list);
  }

  const chunks: Chunk[] = [];
  for (const event of events as EventRow[]) {
    chunks.push(eventChunk(event, catsByEvent.get(event.id) ?? []));
  }
  for (const c of cats) {
    chunks.push(categoryChunk(c, eventNames.get(c.event_id) ?? "this event"));
  }

  const bounded = chunks.slice(0, MAX_CHUNKS);
  if (bounded.length === 0) return { indexed: 0 };

  const vectors = await embedTexts(bounded.map((c) => c.content));
  if (!vectors) return { indexed: 0 };

  const rows = bounded.map((chunk, i) => ({
    organization_id: organizationId,
    source_type: chunk.sourceType,
    source_id: chunk.sourceId,
    content: chunk.content,
    embedding: toVectorLiteral(vectors[i]),
    metadata: chunk.metadata,
  }));

  const { error } = await supabase
    .from("org_embeddings")
    .upsert(rows, { onConflict: "organization_id,source_type,source_id" });

  if (error) return { indexed: 0 };

  return { indexed: rows.length };
}
