import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import {
  embedText,
  embeddingsEnabled,
  toVectorLiteral,
} from "@/lib/ai/embeddings";

export type RetrievedChunk = {
  content: string;
  sourceType: string;
  sourceId: string | null;
  similarity: number;
};

export async function retrieveOrgContext(
  organizationId: string,
  query: string,
  k?: number,
): Promise<RetrievedChunk[]> {
  if (!embeddingsEnabled()) return [];

  const vec = await embedText(query);
  if (!vec) return [];

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("match_org_embeddings", {
    match_org_id: organizationId,
    query_embedding: toVectorLiteral(vec),
    match_count: k ?? 6,
  });

  if (error || !data) return [];

  type MatchRow = {
    content: string;
    source_type: string;
    source_id: string | null;
    similarity: number;
  };
  return (data as MatchRow[]).map((row) => ({
    content: row.content,
    sourceType: row.source_type,
    sourceId: row.source_id,
    similarity: row.similarity,
  }));
}
