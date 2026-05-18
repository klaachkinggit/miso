---
name: api-error-handling
description: Use this skill when performing API error handling for HTTP services, server actions, clients, and integration boundaries.
---

# Goal
Make API failures predictable for clients, observable for operators, and safe for users.

# Instructions
1. Define the error taxonomy: validation, authentication, authorization, not found, conflict, rate limit, upstream, and internal.
2. Map domain failures to stable HTTP status codes and response shapes.
3. Log server-side details with request context while returning safe client messages.
4. Preserve retry semantics with idempotency keys or clear transient/permanent error signals where needed.
5. Update client handling for error states, toasts, forms, and retry actions.
6. Test expected failures, unexpected exceptions, and upstream timeouts.

# Input
Use the API routes, clients, domain errors, logging system, and existing error helpers.

# Output
Generate error classes/helpers, handler changes, client error states, and tests.

# Best Practices
- Do not expose stack traces or secrets in responses.
- Keep error shapes stable and documented through types.
- Distinguish user-correctable errors from system failures.
- Include correlation identifiers when the stack supports them.
- Avoid swallowing errors that should fail the request.
