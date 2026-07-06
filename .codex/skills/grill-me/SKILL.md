---
name: grill-me
description: Matt Pocock skill for interviewing the user about a plan or design until every decision branch is resolved before implementation.
---

# Grill Me

Source: https://github.com/mattpocock/skills

Use when a task is large, ambiguous, underspecified, or likely to hide product/design decisions.

Ask the full set of questions before writing code:

- Scope and explicit non-goals.
- User-visible behavior and acceptance criteria.
- Edge cases and failure modes.
- Dependencies, data flow, and mutation points.
- Error handling, rollback, performance, and security concerns.
- Tests needed to prove the behavior.

Stop after the questions and wait for answers. Do not implement until the user confirms the shape.
