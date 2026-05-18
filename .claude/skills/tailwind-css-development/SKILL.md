---
name: tailwind-css-development
description: Use this skill when performing Tailwind CSS development for pages, components, responsive states, and design tokens.
---

# Goal
Use Tailwind CSS to build maintainable, responsive interfaces that follow the project's token system and avoid utility sprawl.

# Instructions
1. Inspect the Tailwind config, global CSS, component primitives, and class naming patterns before adding styles.
2. Prefer existing tokens for color, spacing, radius, shadow, typography, and breakpoints.
3. Compose repeated class groups into components, variants, or helper utilities when duplication becomes meaningful.
4. Use responsive, state, dark-mode, motion-safe, and accessibility variants intentionally.
5. Keep class strings readable by grouping layout, spacing, typography, color, and state styles consistently.
6. Verify purge/content configuration covers any dynamically generated classes.

# Input
Use the requested UI, existing Tailwind configuration, design system conventions, and target framework.

# Output
Generate Tailwind-styled components, pages, or utility abstractions with responsive and interactive states.

# Best Practices
- Avoid arbitrary values unless they encode a deliberate design detail.
- Do not build one-off palettes when theme tokens should be extended.
- Keep variant logic close to the component API.
- Use `clsx`, `cva`, or local helpers when the repo already uses them.
- Preserve accessibility with visible focus states and sufficient contrast.
