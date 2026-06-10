---
name: security-best-practices
description: Use this skill when performing security best practices work for application code, APIs, authentication, data handling, dependencies, and configuration.
---

# Goal
Reduce security risk by applying practical controls at trust boundaries, sensitive data paths, and privileged operations.

# Instructions
1. Identify assets, actors, trust boundaries, secrets, permissions, and abuse cases.
2. Validate input, authorize server-side, and keep sensitive operations behind explicit checks.
3. Protect secrets in environment variables or secret stores; never commit or log them.
4. Use safe defaults for cookies, CORS, CSRF, headers, rate limits, file handling, and redirects.
5. Review dependencies, generated code, and third-party integrations for known risks.
6. Add tests or checks for authorization bypasses and validation failures where practical.

# Input
Use the target feature, threat context, data sensitivity, framework, deployment environment, and existing security patterns.

# Output
Generate secure code changes, configuration updates, tests, and concise risk notes.

# Best Practices
- Never trust client-side checks for security decisions.
- Use parameterized queries and safe ORM APIs.
- Keep least privilege for API keys, database access, and service roles.
- Avoid exposing internal errors, stack traces, or sensitive identifiers.
- Treat webhooks and callbacks as untrusted until signatures and payloads are verified.
