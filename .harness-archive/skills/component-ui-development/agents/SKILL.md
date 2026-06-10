---
name: component-ui-development
description: Use this skill when performing component-based UI development across reusable interface primitives and composed features.
---

# Goal
Build reusable UI components with clear APIs, predictable states, and styling that fits the product's design system.

# Instructions
1. Identify whether the need is a primitive, composed component, or feature-specific component.
2. Match the repo's component patterns for props, variants, styling, file location, and tests.
3. Define supported states: default, hover, focus, active, disabled, loading, empty, error, and selected where relevant.
4. Keep business logic out of generic UI primitives.
5. Make component APIs small, typed, and difficult to misuse.
6. Add story/demo/test coverage when the repo has that practice or the component has meaningful states.

# Input
Use the requested component behavior, visual requirements, state matrix, data shape, and existing component library.

# Output
Generate component code, styles, tests, and usage examples as needed.

# Best Practices
- Prefer composition over large boolean prop APIs.
- Expose accessible names and keyboard interactions.
- Keep styling variants centralized.
- Avoid leaking implementation details into callers.
- Preserve stable layout under dynamic content.
