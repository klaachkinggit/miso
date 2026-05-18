---
name: frontend-accessibility-wcag
description: Use this skill when performing Accessibility (WCAG) frontend development for web interfaces.
---

# Goal
Make frontend interfaces perceivable, operable, understandable, and robust for users with different abilities and assistive technologies.

# Instructions
1. Identify the applicable WCAG expectations for the component or flow.
2. Use semantic HTML and native controls before adding ARIA.
3. Ensure keyboard access, visible focus, logical focus order, and escape/close behavior for overlays.
4. Provide accessible names, descriptions, error messages, status announcements, and form associations.
5. Check color contrast, target size, motion preferences, zoom behavior, and text resizing.
6. Run automated checks when available and manually inspect the critical keyboard path.

# Input
Use the target flow, UI states, content, framework, and accessibility bugs or acceptance criteria.

# Output
Generate accessible markup, component behavior, styles, tests, and remediation notes.

# Best Practices
- Do not use ARIA to patch avoidable semantic problems.
- Keep focus management deterministic for dialogs, menus, popovers, and route changes.
- Make errors specific and connected to their fields.
- Respect `prefers-reduced-motion`.
- Treat automated accessibility tools as a baseline, not complete proof.
