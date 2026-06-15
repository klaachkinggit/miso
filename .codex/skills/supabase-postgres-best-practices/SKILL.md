---
name: supabase-postgres-best-practices
description: Postgres/Supabase performance and schema checklist for SQL, indexes, RLS, migrations, and query review.
license: MIT
metadata:
  author: supabase
  version: "1.1.1"
  organization: Supabase
  date: January 2026
---

# Supabase Postgres Best Practices

Use when writing/reviewing SQL, schema, RLS, indexes, or performance-sensitive data access.

## Priority

1. Query performance: `EXPLAIN (ANALYZE, BUFFERS)`, missing indexes, bad joins, scans.
2. Connection management: pooling, short transactions, no idle-in-transaction.
3. Security/RLS: least privilege, indexed predicates, avoid per-row auth function cost.
4. Schema: constraints, indexed foreign keys, stable primary keys, lower-case identifiers.
5. Locking: short locks, consistent write order, advisory locks only when needed.
6. Data access: avoid N+1, use keyset pagination for large lists, batch writes.
7. Monitoring: `pg_stat_statements`, vacuum/analyze, slow query logs.

Prefer measured plans over guesses.
