import { beforeEach, describe, expect, it } from "vitest";

// Env-gated no-op contract: with neither ANTHROPIC_API_KEY nor OPENAI_API_KEY
// set, the AI layer must report disabled and every embeddings helper returns
// null without touching a provider. aiChatEnabled/embeddingsEnabled read
// process.env at call time, so deleting the keys per test is sufficient.
describe("AI config no-op without API keys", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("reports chat disabled when ANTHROPIC_API_KEY is unset", async () => {
    const { aiChatEnabled } = await import("@/lib/ai/client");
    expect(aiChatEnabled()).toBe(false);
  });

  it("reports embeddings disabled when OPENAI_API_KEY is unset", async () => {
    const { embeddingsEnabled } = await import("@/lib/ai/embeddings");
    expect(embeddingsEnabled()).toBe(false);
  });

  it("embedText resolves to null when embeddings are disabled", async () => {
    const { embedText } = await import("@/lib/ai/embeddings");
    expect(await embedText("x")).toBeNull();
  });

  it("embedTexts resolves to null when embeddings are disabled", async () => {
    const { embedTexts } = await import("@/lib/ai/embeddings");
    expect(await embedTexts(["x"])).toBeNull();
  });
});
