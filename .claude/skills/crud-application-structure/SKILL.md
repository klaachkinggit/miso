---
name: crud-application-structure
description: Use this skill when performing CRUD application structure work for create, read, update, delete, listing, and detail workflows.
---

# Goal
Structure CRUD workflows so data operations, permissions, validation, and UI states are clear and maintainable.

# Instructions
1. Define the entity lifecycle, ownership rules, and allowed operations.
2. Build list, detail, create, edit, delete/archive, and restore flows as needed.
3. Centralize validation, authorization, and persistence patterns using existing repo conventions.
4. Add pagination, filtering, sorting, search, and empty states when lists need them.
5. Handle optimistic updates, stale data, confirmation, and destructive action recovery.
6. Test each operation, including unauthorized and invalid requests.

# Input
Use the entity definition, fields, permissions, UI requirements, API patterns, and persistence layer.

# Output
Generate CRUD routes/actions, pages/components, schemas, data access code, tests, and type updates.

# Best Practices
- Prefer soft delete or archive when business recovery matters.
- Keep destructive actions explicit and reversible where possible.
- Avoid duplicating form schemas between create and edit without a reason.
- Make ownership checks server-side.
- Design list views for realistic data volume.
