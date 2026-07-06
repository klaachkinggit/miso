---
name: diagnosing-bugs
description: Matt Pocock skill for hard bugs and performance regressions: build a tight feedback loop, reproduce, minimize, hypothesize, instrument, fix, regression-test.
---

# Diagnosing Bugs

Source: https://github.com/mattpocock/skills

Use when the user says debug, diagnose, broken, failing, throwing, flaky, or slow.

Process:

1. Build a tight pass/fail loop that catches the user's exact symptom.
2. Reproduce and minimize the failure.
3. Write three to five ranked, falsifiable hypotheses.
4. Instrument one hypothesis at a time.
5. Fix the confirmed root cause.
6. Add or preserve a regression check at the right seam.
7. Remove debug instrumentation and state the confirmed cause.

Do not jump to a hypothesis before a red-capable loop exists.
