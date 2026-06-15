---
name: vercel-react-best-practices
description: React/Next.js performance checklist for components, App Router pages, data fetching, rendering, bundle size, and server/client boundaries.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

Use for React/Next.js implementation, refactor, or performance review.

## Priority

1. Waterfalls: start independent work early, use `Promise.all`, stream with Suspense.
2. Bundle: direct imports, dynamic import heavy client code, defer third-party scripts.
3. Server: authenticate actions/routes, dedupe with `React.cache`, avoid shared mutable request state.
4. Client data: use dedupe/cache, passive listeners, schema/version localStorage.
5. Re-render: primitive deps, derived state in render, functional setState, split hooks.
6. Rendering: stable layout, resource hints, no hydration flicker unless intentional.
7. JS: Map/Set for repeated lookups, cache expensive work, avoid needless loops/sorts.
8. Advanced: use latest refs/effect events only when they simplify stale closures.

## Next.js

- Keep server/client boundary explicit.
- Minimize serialized props into client components.
- Parallelize nested fetches where independent.
- Use official React/Next docs for exact API behavior.
