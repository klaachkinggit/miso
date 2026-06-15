---
name: ui-ux-pro-max
description: Use for UI/UX planning, implementation, or review when a task changes layout, interaction, accessibility, visual style, or product experience.
---

# UI/UX Pro Max

Use this skill for interface work that changes how a screen looks, feels,
moves, or is used. Keep it as a compact decision aid; do not load large design
catalogs into context.

## Apply When

- Designing or refactoring pages, dashboards, admin panels, checkout flows, forms, tables, charts, modals, navigation, or mobile layouts.
- Choosing visual direction, color, typography, spacing, motion, density, or interaction states.
- Reviewing UI for usability, accessibility, responsive behavior, or visual polish.

Skip for backend-only logic, database work, infrastructure, or non-visual scripts.

## Priority Checklist

1. Accessibility: contrast, keyboard flow, focus states, labels, alt text, reduced motion, and screen-reader names for icon-only controls.
2. Touch and interaction: 44px+ targets, visible press/loading/error states, no hover-only critical actions.
3. Layout: mobile-first, no horizontal scroll, stable dimensions for fixed-format controls, readable hierarchy, safe spacing.
4. Product fit: pick one clear aesthetic direction that fits the product and keep it consistent.
5. Typography and color: semantic tokens, readable type scale, no viewport-based font scaling, no negative letter spacing.
6. Performance: reserve media space, lazy-load non-critical assets, avoid layout shift and heavy main-thread work.
7. Motion: purposeful 150-300ms transitions, transform/opacity over layout properties, respect reduced motion.
8. Forms and feedback: visible labels, local errors, disabled/loading/success states, progressive disclosure.
9. Navigation: predictable back paths, deep links where useful, no overloaded menus.
10. Data displays: accessible legends/tooltips, tabular numbers, no color-only meaning.

## Aesthetic Selection

Commit to one direction before coding. For Miso's operational SaaS surfaces,
default to dense, restrained, scannable interfaces. For public brand pages, use
strong first-viewport product/place/person signals and real visual assets.

Avoid generic AI design tells: decorative blobs, random gradients, nested cards,
oversized marketing sections for tools, mismatched icon styles, and text that
explains how to use the interface inside the app.

## Final Audit

Before shipping UI work, verify desktop and mobile rendering. Check that text
fits, controls do not shift, assets load, contrast is acceptable, and every
primary workflow has visible states for loading, empty, error, and success.
