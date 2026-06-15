---
name: find-skills
description: Find/install agent skills when user asks for missing capability, new skill, or whether a skill exists.
---

# Find Skills

Use when user wants extra agent capability.

## Flow

1. Clarify requested capability only if ambiguous.
2. Search available installed skills first.
3. Search install candidates only for exact/near-exact requested capability.
4. Prefer plugin/connector only when user explicitly asks for that tool class or skill is unavailable.
5. Install only after exact match and user intent is clear.

## Guardrails

- Do not install broad adjacent tools.
- Do not vendor duplicates of base tools.
- Prefer user-level skills for personal workflow; repo-local skills only when project-specific.
- After install, explain trigger and where it lives.
