---
name: css-layout-systems
description: Use this skill when performing CSS layout systems work with Flexbox, Grid, positioning, containment, and responsive spacing.
---

# Goal
Build robust layouts that adapt cleanly, avoid overlap, and express the intended hierarchy with predictable CSS.

# Instructions
1. Determine whether the layout is one-dimensional, two-dimensional, fixed-format, fluid, or content-driven.
2. Use Flexbox for one-axis alignment and distribution; use Grid for two-axis tracks, dashboards, galleries, and app shells.
3. Define stable dimensions with `minmax`, `clamp`, aspect ratios, intrinsic sizing, and sensible min/max constraints.
4. Use logical properties and container-aware spacing where appropriate.
5. Avoid fragile absolute positioning for core layout; reserve positioning for overlays, badges, decorations, and controlled layering.
6. Test long text, empty content, narrow screens, and wide screens.

# Input
Use the desired visual layout, content types, breakpoints, browser support, and existing CSS architecture.

# Output
Generate CSS, utility classes, or component styles that create stable Flexbox/Grid layouts.

# Best Practices
- Prefer content-resilient layouts over fixed pixel compositions.
- Use `gap` instead of margin hacks for related layout spacing.
- Use `min-width: 0` and `overflow-wrap` where flex/grid text can overflow.
- Keep z-index scales small and documented through tokens when possible.
- Avoid layout shifts caused by hover states, loading text, images, or dynamic counts.
