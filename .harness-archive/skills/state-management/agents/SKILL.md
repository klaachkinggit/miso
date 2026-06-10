---
name: state-management
description: Use this skill when performing state management for frontend, server state, forms, URL state, and cross-component interactions.
---

# Goal
Manage state in the simplest place that preserves correctness, performance, and user experience.

# Instructions
1. Classify state as local UI, form, server/cache, URL, persistent client storage, or global app state.
2. Prefer local state until sharing, persistence, or synchronization requires more.
3. Use the repo's established state tools for server data, global stores, and forms.
4. Keep derived state computed from source data instead of duplicated.
5. Handle loading, stale, optimistic, error, and reset behavior explicitly.
6. Test state transitions and race conditions for async interactions.

# Input
Use the interaction requirements, data ownership, framework, existing libraries, and performance constraints.

# Output
Generate state logic, hooks, reducers/stores, URL synchronization, cache updates, and tests.

# Best Practices
- Do not mirror props into state unless editing or buffering is required.
- Keep global stores small and domain-focused.
- Use URL state for shareable filters and navigation context.
- Avoid race bugs with aborts, request keys, or mutation ordering.
- Persist only non-sensitive data that should survive reloads.
