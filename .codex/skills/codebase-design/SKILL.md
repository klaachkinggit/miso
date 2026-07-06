---
name: codebase-design
description: Matt Pocock skill for designing deep modules: small interfaces, clean seams, testable behavior, and shared architecture vocabulary.
---

# Codebase Design

Source: https://github.com/mattpocock/skills

Use when designing or improving a module interface, deciding where a seam belongs, making code more testable, or improving AI navigability.

Vocabulary:

- Module: anything with an interface and implementation.
- Interface: everything callers must know to use the module correctly.
- Depth: leverage at the interface.
- Seam: where the module interface lives.
- Adapter: a concrete thing satisfying an interface at a seam.
- Locality: change, bugs, and verification concentrated in one place.

Principles:

- Prefer deep modules: small interface, useful implementation.
- Apply the deletion test: if deleting a module removes complexity, it was likely pass-through code.
- The interface is the test surface.
- One adapter is a hypothetical seam; two adapters make a real seam.
- Do not add seams unless behavior actually varies there.
