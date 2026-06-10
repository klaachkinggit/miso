---
name: database-schema-design
description: Use this skill when performing database schema design for tables, relationships, constraints, indexes, migrations, and data integrity.
---

# Goal
Design database schemas that preserve data integrity, support product queries, and remain maintainable as the domain evolves.

# Instructions
1. Understand the domain entities, relationships, lifecycle states, and query patterns.
2. Choose table boundaries, primary keys, foreign keys, uniqueness, nullability, and check constraints deliberately.
3. Add indexes that match read paths, joins, filters, ordering, and uniqueness requirements.
4. Plan migrations for existing data and rollback safety where relevant.
5. Keep schema changes aligned with generated types, validators, and application code.
6. Test constraints, permissions, and representative queries.

# Input
Use the domain model, expected queries, write paths, consistency requirements, database engine, and migration system.

# Output
Generate migrations, schema definitions, constraints, indexes, seed updates, types, and tests.

# Best Practices
- Prefer database constraints for invariants that must always hold.
- Avoid premature denormalization without measured query pressure.
- Use transactions for multi-row consistency.
- Keep enum/state transitions explicit.
- Consider privacy, retention, and authorization at schema design time.
