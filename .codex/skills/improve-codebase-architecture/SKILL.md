---
name: improve-codebase-architecture
description: Matt Pocock skill for scanning a codebase for deepening opportunities and presenting architecture improvements before refactoring.
---

# Improve Codebase Architecture

Source: https://github.com/mattpocock/skills

Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.

Process:

1. Read `CONTEXT.md` and relevant ADRs if present.
2. Explore organically for friction:
   - Concepts that require bouncing between many modules.
   - Shallow modules.
   - Coupling leaking across seams.
   - Logic extracted only for testability while bugs hide in callers.
   - Untested or hard-to-test areas.
3. Present deepening candidates with files, problem, solution, benefits, and recommendation strength.
4. Use `codebase-design` vocabulary.
5. Ask which candidate the user wants to explore before refactoring.

Do not propose interfaces before the user picks a candidate.
