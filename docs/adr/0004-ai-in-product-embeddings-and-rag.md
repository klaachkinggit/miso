# AI In-Product: OpenAI Embeddings + pgvector RAG with Org Isolation

P1.6 adds two AI surfaces: an org-admin **copilot** (`/admin`) and a public storefront **buyer assistant** (`/s/{slug}`). Chat generation runs on Anthropic via the Vercel AI SDK. The buyer assistant must answer from an organization's own content, which requires retrieval-augmented generation — and therefore an embeddings model and a vector store. This records the architecturally significant, hard-to-reverse choices.

## Decision

- **Chat**: Anthropic through `@ai-sdk/anthropic` (`createAnthropic`), default model `claude-sonnet-4-6` (overridable via `MISO_AI_MODEL`), streamed with `streamText().toTextStreamResponse()`.
- **Embeddings**: **OpenAI `text-embedding-3-small` (1536-dim)** through `@ai-sdk/openai`. Anthropic has **no embeddings API**, so RAG cannot be single-vendor. OpenAI is introduced _solely_ for embeddings.
- **Vector store**: a pgvector `org_embeddings` table (`vector(1536)`, HNSW cosine index) holding each org's public content (events, ticket tiers, FAQs). Retrieval goes through a SQL function `match_org_embeddings(query_embedding, match_org_id, match_count)`.
- **Env-gating**: chat needs `ANTHROPIC_API_KEY` (absent ⇒ HTTP 503); embeddings/RAG need `OPENAI_API_KEY` (absent ⇒ helpers no-op and return empty). With neither key the whole feature is inert and local/CI stay green.

## Cross-org isolation (non-negotiable)

The buyer assistant is public and serves many organizations from one deployment, so a retrieval leak across orgs would be a PII/data breach. Two independent guards:

1. The **org id is resolved server-side** from the storefront slug (`getActiveOrganizationBySlug`); a client-supplied id is never used for retrieval scope.
2. `match_org_embeddings` takes `match_org_id` as a **required argument and applies the filter inside the function**, so a caller cannot omit it. Management writes are governed by `is_organization_admin` RLS; all server-side reads use the service role.

## Why this is hard to reverse

- It commits the platform to a **second AI vendor (OpenAI)** for embeddings.
- The **embedding model and its 1536 dimensions are baked into the schema** (column type + HNSW index). Changing the model or dimensionality means a migration _and_ re-embedding all stored content.

## Alternatives considered

- **Anthropic-only** — impossible; no embeddings API.
- **Local/self-hosted embeddings** (e.g. transformers.js) — rejected for v1 on quality and operational cost; revisitable since the store and retrieval interface are model-agnostic apart from dimensionality.
- **Keyword/full-text search instead of vectors** — rejected for materially worse recall on natural-language buyer questions.

## Consequences

- One additional vendor key (`OPENAI_API_KEY`) to provision; everything degrades to a clean no-op without it.
- Embedding model/dimension is now a schema-level commitment (see "hard to reverse").
- Re-indexing is on-demand (`POST /api/ai/reindex`, org-admin); there is no automatic content-change trigger yet — a deliberate v1 scope cut.
