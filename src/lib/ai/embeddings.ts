import "server-only";
import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel } from "ai";

const EMBEDDING_MODEL_ID = "text-embedding-3-small";

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let cached: EmbeddingModel | null = null;

function embeddingModel(): EmbeddingModel | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!cached)
    cached = createOpenAI({ apiKey }).textEmbeddingModel(EMBEDDING_MODEL_ID);
  return cached;
}

export async function embedText(value: string): Promise<number[] | null> {
  const model = embeddingModel();
  if (!model) return null;
  const { embedding } = await embed({ model, value });
  return embedding;
}

export async function embedTexts(values: string[]): Promise<number[][] | null> {
  const model = embeddingModel();
  if (!model || values.length === 0) return null;
  const { embeddings } = await embedMany({ model, values });
  return embeddings;
}

export function toVectorLiteral(v: number[]): string {
  return JSON.stringify(v);
}
