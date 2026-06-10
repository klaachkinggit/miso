---
name: responsive-web-design
description: Use this skill when performing responsive web design across mobile, tablet, desktop, and wide viewport layouts.
---

# Goal
Create interfaces that remain usable, readable, and visually composed across viewport sizes and input methods.

# Instructions
1. Start from the narrowest realistic viewport and define the core content priority.
2. Add layout changes at content-driven breakpoints, not arbitrary device assumptions.
3. Use fluid sizing with `clamp`, percentage tracks, `minmax`, and aspect-ratio constraints.
4. Adapt navigation, tables, media, controls, and dense layouts for touch and keyboard use.
5. Check text wrapping, button labels, image cropping, sticky elements, and overflow at each breakpoint.
6. Verify desktop and mobile behavior in the browser when possible.

# Input
Use the target screens, content density, workflow priority, and existing responsive conventions.

# Output
Generate responsive components, pages, CSS, and layout rules that handle the requested breakpoints.

# Best Practices
- Prefer mobile-first CSS unless the codebase uses another convention.
- Keep touch targets at least 44px where practical.
- Avoid hiding essential actions on small screens.
- Use responsive images and avoid loading oversized assets for mobile.
- Ensure no text or controls overlap at narrow widths.
