---
name: full-stack-feature-development
description: Use this skill when performing full-stack feature development across UI, API, database, validation, and tests.
---

# Goal
Deliver complete product features that connect the user interface, server logic, data model, and verification end to end.

# Instructions
1. Trace the feature across user workflow, data model, API/server actions, permissions, and UI states.
2. Reuse existing architecture boundaries and domain services.
3. Implement the smallest coherent vertical slice before expanding edge cases.
4. Add validation, authorization, persistence, optimistic or loading behavior, and error recovery.
5. Update tests at the appropriate levels: unit, integration, e2e, or contract.
6. Run targeted verification and inspect the diff for unrelated changes.

# Input
Use the user story, acceptance criteria, existing architecture, data contracts, and design requirements.

# Output
Generate database changes, backend logic, frontend UI, state handling, tests, and documentation updates when needed.

# Best Practices
- Keep server-owned decisions on the server.
- Avoid coupling UI components directly to persistence details when services already exist.
- Make partial failure and retries explicit.
- Preserve type safety across boundaries.
- Keep the final diff scoped to the feature.
