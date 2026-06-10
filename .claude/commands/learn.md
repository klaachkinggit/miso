---
description: Append an end-of-task lesson (heuristic for next time) to LESSONS.md
allowed-tools: Read, Edit, Write
argument-hint: <what surprised you / what worked / what failed>
---

Append a lesson to `LESSONS.md`: $ARGUMENTS

Rules:
- Append-only. Today's date.
- Skip unless **non-obvious** — if it's already documented elsewhere or self-evident, don't write it.
- Format:

```
## YYYY-MM-DD — short title  [workflow|debug|test|arch|tools|prompt|cost]
- **Saw:** what happened (one line).
- **Why:** the underlying reason it worked / failed.
- **Next time:** the heuristic future-you will actually re-read.
```

The "Next time" line is the only one that matters in future sessions. If you can't write a useful one, don't append the entry at all.
