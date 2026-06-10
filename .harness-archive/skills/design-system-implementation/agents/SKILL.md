---
name: design-system-implementation
description: Use this skill when performing design system implementation with tokens, components, variants, documentation, and adoption work.
---

# Goal
Implement coherent design system foundations and components that make product UI consistent, reusable, and easier to evolve.

# Instructions
1. Audit existing tokens, primitives, naming conventions, and component APIs before adding new system pieces.
2. Define or extend tokens for color, typography, spacing, radius, elevation, motion, and breakpoints.
3. Build primitives first, then compose feature components from them.
4. Encode variants and sizes through typed APIs or established styling helpers.
5. Document expected usage in the local style used by the repo, such as stories, examples, or comments.
6. Migrate only the surfaces needed for the task unless the user asks for broader adoption.

# Input
Use the product UI requirements, brand direction, existing design system, target components, and adoption scope.

# Output
Generate tokens, components, variants, styles, examples, and focused migrations.

# Best Practices
- Keep tokens semantic when they represent product meaning.
- Avoid duplicating primitives with slightly different behavior.
- Preserve accessibility states in every variant.
- Design for theming only when the product needs it.
- Keep breaking API changes explicit and tested.
