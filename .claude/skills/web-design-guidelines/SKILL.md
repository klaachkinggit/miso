---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines, accessibility, UX, responsive behavior, and design quality.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Design Guidelines

Use for UI review.

## Check

- Semantic HTML, labels, alt text, heading order.
- Keyboard navigation, focus visibility, ARIA only when needed.
- Contrast, reduced motion, readable typography.
- Responsive layout, no overflow, touch targets.
- Form errors near fields, loading/empty/error/success states.
- Performance: image sizes, layout shift, heavy client JS.

Return findings first with file/line refs when reviewing code.
