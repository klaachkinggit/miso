---
name: authentication-systems
description: Use this skill when performing authentication systems work including login, signup, sessions, tokens, password flows, OAuth, and account security.
---

# Goal
Implement authentication flows that verify identity reliably, protect sessions, and fit the application's security model.

# Instructions
1. Identify the auth provider, session mechanism, token format, user model, and trust boundaries.
2. Use established provider SDKs and framework integrations instead of custom crypto or ad hoc session handling.
3. Validate credentials or provider callbacks server-side and bind sessions to the correct user record.
4. Protect routes, API handlers, and server actions with consistent auth checks.
5. Implement logout, expiration, refresh, CSRF protection, and account recovery as required.
6. Test unauthorized, expired, malformed, cross-user, and happy-path cases.

# Input
Use the requested auth flow, provider, user roles, route protection needs, and existing auth utilities.

# Output
Generate auth routes/actions, middleware, session handling, UI integration, tests, and configuration notes.

# Best Practices
- Do not store plaintext passwords, secrets, or tokens in logs.
- Use secure, httpOnly, sameSite cookies for browser sessions when applicable.
- Verify authorization separately from authentication.
- Rate-limit sensitive endpoints where the stack supports it.
- Keep error messages safe without preventing legitimate recovery.
