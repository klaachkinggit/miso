---
name: code-refactoring
description: Use this skill when performing code refactoring to improve structure, readability, duplication, modularity, or maintainability without changing behavior.
---

# Goal
Improve code structure while preserving externally visible behavior.

# Instructions
1. Identify the behavior that must remain unchanged and the tests or checks that protect it.
2. Make small, behavior-preserving transformations with clear boundaries.
3. Prefer existing abstractions and naming patterns over new architecture.
4. Remove duplication only when the shared abstraction is stable and improves comprehension.
5. Run targeted tests before and after risky changes when possible.
6. Review the diff to ensure no unrelated formatting or behavior changes slipped in.

# Input
Use the target code, pain point, desired outcome, constraints, and existing tests.

# Output
Generate focused code changes, updated tests if needed, and a concise explanation of the refactor.

# Best Practices
- Avoid broad rewrites unless the user asked for them.
- Keep commits/diffs easy to review.
- Preserve public APIs unless changing them is part of the request.
- Use types and tests to pin behavior.
- Do not mix refactors with feature changes unless necessary.
