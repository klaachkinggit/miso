---
description: Convert plan, PRD, or spec into vertically-sliced GitHub issues
allowed-tools: Read, Bash, Glob
argument-hint: <plan text or @file.md>
---

Convert $ARGUMENTS into GitHub issues.

Rules:
- **Vertical slices only** — each issue delivers end-to-end value (UI + API + DB + test). No horizontal slices ("do all DB migrations" = wrong).
- **One session per issue** — if it takes more than one focused session, split it.
- **Dependencies explicit** — "Blocked by #X" if relevant.

Issue format:
```
Title: [verb] [thing]   ← imperative, short

## Context
Why this exists.

## Acceptance criteria
- [ ] Specific, testable condition
- [ ] ...

## Out of scope
What this explicitly does NOT cover.
```

Output a numbered list ready to paste into GitHub. Ask for confirmation before creating via `gh issue create`.
