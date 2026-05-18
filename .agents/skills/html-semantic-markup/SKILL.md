---
name: html-semantic-markup
description: Use this skill when performing HTML structure and semantic markup tasks.
---

# Goal
Create meaningful, accessible HTML structures that communicate document hierarchy, interaction purpose, and content relationships clearly.

# Instructions
1. Identify the page or component landmarks: header, nav, main, aside, section, article, footer, form, and dialog.
2. Choose native HTML elements before adding ARIA. Use buttons for actions, anchors for navigation, labels for form controls, and lists for repeated related items.
3. Establish a logical heading outline and readable source order.
4. Include names, labels, alt text, captions, and descriptions where users or assistive technology need them.
5. Keep markup minimal and avoid div-heavy structures unless layout or framework constraints require wrappers.
6. Validate links, form associations, disabled states, and interactive element nesting.

# Input
Use the user's content, intended hierarchy, interactions, target framework, and existing component conventions.

# Output
Generate semantic HTML or JSX/TSX markup with accessible structure, correct elements, and concise attributes.

# Best Practices
- Prefer native semantics over custom roles.
- Do not nest interactive controls inside other interactive controls.
- Keep heading levels sequential and meaningful.
- Use `aria-*` only when native HTML cannot express the behavior.
- Ensure source order matches visual and keyboard navigation order.
