import { beforeEach, describe, expect, it, vi } from "vitest";

// Mutable mock surface shared with the vi.mock factories below. embeddingsEnabled
// + embedText drive the retrieval branch; rpc captures the args passed to the
// match_org_embeddings RPC so we can assert cross-org isolation.
const aiState = vi.hoisted(() => ({
  enabled: false,
  vector: [] as number[] | null,
}));

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/embeddings", () => ({
  embeddingsEnabled: () => aiState.enabled,
  embedText: async () => aiState.vector,
  // pass-through literal so the RPC sees the raw embedding we asserted on
  toVectorLiteral: (v: number[]) => JSON.stringify(v),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ rpc }),
}));

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  aiState.enabled = false;
  aiState.vector = null;
  rpc.mockReset();
});

describe("retrieveOrgContext", () => {
  it("returns [] and makes no supabase call when embeddings are disabled", async () => {
    aiState.enabled = false;
    const { retrieveOrgContext } = await import("@/lib/ai/retrieval");

    const result = await retrieveOrgContext("org-1", "q");

    expect(result).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the server-resolved org id through to match_org_embeddings (cross-org isolation)", async () => {
    aiState.enabled = true;
    aiState.vector = [0.1, 0.2, 0.3];
    rpc.mockResolvedValue({
      data: [
        {
          content: "Friday night techno",
          source_type: "event",
          source_id: "evt-1",
          similarity: 0.91,
        },
        {
          content: "GA tier — 25 EUR",
          source_type: "category",
          source_id: "cat-1",
          similarity: 0.84,
        },
      ],
      error: null,
    });

    const { retrieveOrgContext } = await import("@/lib/ai/retrieval");
    const result = await retrieveOrgContext("org-1", "techno");

    expect(rpc).toHaveBeenCalledWith(
      "match_org_embeddings",
      expect.objectContaining({ match_org_id: "org-1" }),
    );

    // returned rows are mapped to the RetrievedChunk shape
    expect(result).toEqual([
      { content: "Friday night techno", sourceType: "event", sourceId: "evt-1", similarity: 0.91 },
      { content: "GA tier — 25 EUR", sourceType: "category", sourceId: "cat-1", similarity: 0.84 },
    ]);
  });

  it("returns [] when embedText yields no vector", async () => {
    aiState.enabled = true;
    aiState.vector = null;
    const { retrieveOrgContext } = await import("@/lib/ai/retrieval");

    expect(await retrieveOrgContext("org-1", "q")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns [] on an RPC error instead of throwing", async () => {
    aiState.enabled = true;
    aiState.vector = [0.1];
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const { retrieveOrgContext } = await import("@/lib/ai/retrieval");
    expect(await retrieveOrgContext("org-1", "q")).toEqual([]);
  });
});
