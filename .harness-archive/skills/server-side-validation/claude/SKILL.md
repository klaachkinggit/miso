---
name: server-side-validation
description: Use this skill when performing server-side validation for inputs, commands, forms, API requests, and data integrity.
---

# Goal
Validate untrusted data at server boundaries so application logic receives safe, typed, and normalized inputs.

# Instructions
1. Identify every untrusted boundary: forms, API requests, webhooks, files, query params, headers, and background jobs.
2. Use the repo's schema library or validation pattern.
3. Normalize data after validation, including trimming, parsing, coercing, and defaulting only where safe.
4. Return field-level and request-level errors that clients can display.
5. Re-check authorization and server-owned values after validation.
6. Add tests for missing, malformed, boundary, malicious, and valid inputs.

# Input
Use the incoming payload, expected schema, framework, existing validators, and error response conventions.

# Output
Generate validation schemas, server handlers, error mapping, tests, and type updates.

# Best Practices
- Never rely on client-side validation alone.
- Avoid unsafe coercion that changes meaning.
- Validate IDs, ownership, enum states, file types, and numeric ranges.
- Keep validation messages useful but not sensitive.
- Reuse schemas where it avoids drift without coupling unrelated boundaries.
