---
name: rest-api-development
description: Use this skill when performing REST API development for resources, routes, handlers, clients, and integration contracts.
---

# Goal
Build REST APIs with clear resource modeling, predictable status codes, validation, authorization, and error responses.

# Instructions
1. Model resources and actions with clear route names and HTTP methods.
2. Define request schemas, response schemas, auth requirements, and side effects before implementation.
3. Validate inputs at the boundary and normalize output shapes.
4. Use correct status codes for success, validation errors, auth failures, conflicts, not found, and server errors.
5. Add tests for happy path, invalid input, authorization, and relevant edge cases.
6. Update clients, types, docs, or examples that consume the API.

# Input
Use the resource requirements, data model, auth context, framework conventions, and existing API patterns.

# Output
Generate API routes, handlers, schemas, service calls, tests, and client updates.

# Best Practices
- Keep handlers thin and move domain logic into services where the repo already does so.
- Never trust client-provided identity or authorization claims.
- Return stable error shapes.
- Make mutating operations idempotent where retries are expected.
- Avoid leaking internal exception details.
