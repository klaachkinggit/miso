import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

const MODEL_ID = process.env.MISO_AI_MODEL ?? "claude-sonnet-4-6";

export function aiChatEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: LanguageModel | null = null;

export function chatModel(): LanguageModel | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!cached) cached = createAnthropic({ apiKey })(MODEL_ID);
  return cached;
}
