---
name: debugging-issue-diagnosis
description: Use this skill when performing debugging and issue diagnosis for failing tests, runtime errors, regressions, flaky behavior, or incorrect output.
---

# Goal
Find the root cause of a bug and fix it with the smallest reliable change.

# Instructions
1. Reproduce the issue or identify the closest available failing signal.
2. Read the error, logs, stack trace, recent diff, and relevant code path before editing.
3. Form a concrete hypothesis and test it with targeted inspection or commands.
4. Fix the root cause, not only the visible symptom.
5. Add or update tests when the bug was not already covered.
6. Run targeted verification and note any remaining uncertainty.

# Input
Use the bug report, failing command, observed behavior, expected behavior, logs, environment, and relevant code.

# Output
Generate a diagnosis, code fix, tests, and verification summary.

# Best Practices
- Avoid shotgun changes.
- Preserve unrelated user work in dirty worktrees.
- Treat flaky failures as timing, isolation, or dependency problems until proven otherwise.
- Include exact file references for meaningful findings.
- Keep temporary debug logging out of the final diff.
