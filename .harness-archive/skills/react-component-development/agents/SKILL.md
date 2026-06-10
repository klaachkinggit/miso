---
name: react-component-development
description: Use this skill when performing React component development with hooks, props, state, effects, and composition.
---

# Goal
Create React components that are typed, accessible, performant, and aligned with the application's rendering model.

# Instructions
1. Inspect whether the project uses React Server Components, client components, routing conventions, and state libraries.
2. Keep components server-rendered unless interactivity requires a client boundary.
3. Design typed props around the component's stable contract, not incidental implementation details.
4. Use hooks only where needed and keep effects synchronized with external systems, not derived render data.
5. Split complex UI into focused components when it improves readability or reuse.
6. Verify hydration-sensitive code, event handlers, loading states, and error boundaries.

# Input
Use the user request, data contracts, framework constraints, existing hooks, and component conventions.

# Output
Generate React/TypeScript component files, styles, tests, and integration changes as needed.

# Best Practices
- Avoid unnecessary `useEffect`, duplicated state, and derived state bugs.
- Memoize only when there is a measured or obvious render cost.
- Keep client components small in Next.js App Router projects.
- Use semantic HTML and accessible controls inside components.
- Preserve type safety for events, refs, and async data.
