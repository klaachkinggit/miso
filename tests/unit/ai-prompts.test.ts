import { describe, expect, it } from "vitest";
import { assistantSystemPrompt, copilotSystemPrompt } from "@/lib/ai/prompts";

describe("AI system prompts", () => {
  it("assistant prompt embeds the org name and the retrieval context", () => {
    const prompt = assistantSystemPrompt("Acme", "CTX");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("CTX");
  });

  it("copilot prompt mentions the org name", () => {
    expect(copilotSystemPrompt("Acme")).toContain("Acme");
  });
});
