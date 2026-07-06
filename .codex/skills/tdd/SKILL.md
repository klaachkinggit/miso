---
name: tdd
description: Matt Pocock skill for test-driven development with a red-green-refactor loop on one vertical slice at a time.
---

# Test-Driven Development

Source: https://github.com/mattpocock/skills

Use when building features or fixing bugs test-first.

Rules:

- Confirm the public seam under test before writing the test.
- Red before green: write the failing test first.
- One seam, one test, one minimal implementation per cycle.
- Test behavior through public interfaces, not implementation details.
- Expected values must come from a spec, literal, fixture, or known-good example.
- Do not bulk-write tests for imagined behavior.
- Refactor only after the behavior slice is green.
