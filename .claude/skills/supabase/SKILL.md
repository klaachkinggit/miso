---
name: supabase
description: Use for any Supabase task: Database, Auth, RLS, Storage, Realtime, Edge Functions, Vectors, Cron, Queues, CLI, SSR clients, migrations.
metadata:
  author: supabase
  version: "0.1.2"
---

# Supabase

Use whenever Supabase appears.

## Rules

- Prefer official Supabase APIs and project patterns.
- For auth in server code, trust `getUser`/claims, not client-provided user IDs.
- RLS is mandatory for user/org-scoped tables.
- Keep service-role key server-only.
- Schema changes go through migrations under `supabase/`.
- After schema changes, regenerate types with repo script.
- Tests should cover RLS/security boundary when behavior changes.

## Next.js

- Use SSR-safe clients for server components/actions/routes.
- Do not leak cookies, JWTs, service role, or anon/service confusion.
- Validate external input at route/action boundary.

## Database

- Use typed queries/helpers where repo provides them.
- Add indexes for RLS predicates and common filters.
- Prefer idempotent migrations.
