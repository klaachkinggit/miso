-- P1.6 AI in-product — pgvector store for the storefront buyer assistant (RAG).
-- Embeddings are derived from an org's PUBLIC content (events, FAQs, storefront
-- copy). Cross-org isolation is enforced two ways: (1) every retrieval query
-- filters organization_id, and (2) match_org_embeddings bakes the org filter in
-- so a caller cannot omit it. OpenAI text-embedding-3-small is 1536-dim.

create extension if not exists vector;

create table if not exists org_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  source_type text not null,            -- 'event' | 'faq' | 'storefront'
  source_id text,                       -- upstream row id when applicable
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_embeddings_org_idx on org_embeddings (organization_id);

-- One embedding per (org, source kind, source row): re-indexing upserts.
create unique index if not exists org_embeddings_source_key
  on org_embeddings (organization_id, source_type, source_id)
  where source_id is not null;

-- HNSW cosine index pairs with the <=> distance operator used below.
create index if not exists org_embeddings_embedding_idx
  on org_embeddings using hnsw (embedding vector_cosine_ops);

drop trigger if exists org_embeddings_touch on org_embeddings;
create trigger org_embeddings_touch before update on org_embeddings
  for each row execute function public.touch_updated_at();

alter table org_embeddings enable row level security;

-- Indexing and retrieval run server-side via the service role (RLS-exempt).
-- Org admins may inspect their own rows; there is no anon/public access — the
-- buyer assistant reads through the service role, never the browser.
drop policy if exists "org_embeddings_admin_all" on org_embeddings;
create policy "org_embeddings_admin_all" on org_embeddings
  for all
  using (public.is_organization_admin(org_embeddings.organization_id))
  with check (public.is_organization_admin(org_embeddings.organization_id));

-- Org-scoped similarity search. match_org_id is REQUIRED and applied inside the
-- function, so a retrieval call can never search across orgs. Returns the
-- closest match_count rows (capped 1..20) by cosine similarity.
create or replace function match_org_embeddings(
  query_embedding vector(1536),
  match_org_id uuid,
  match_count int default 6
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.source_type,
    e.source_id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from org_embeddings e
  where e.organization_id = match_org_id
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;
