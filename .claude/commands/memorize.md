---
description: Append a cross-session memory entry to MEMORY.md
allowed-tools: Read, Edit, Write
argument-hint: <what to remember>
---

Append an entry to `MEMORY.md` capturing: $ARGUMENTS

Rules:
- One entry per change. Append-only — never edit prior entries.
- Skip if derivable from `git log`, `git blame`, or the current code.
- Skip ephemeral task state. Skip secrets.
- Format:

```
## YYYY-MM-DD — short title
- Fact / decision / constraint.
- Why it matters (one line). Link: <PR / ADR / doc>.
```

Use today's date. Keep under ~150 chars per bullet; link out for detail.
