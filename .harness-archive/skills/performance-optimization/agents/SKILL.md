---
name: performance-optimization
description: Use this skill when performing performance optimization for frontend rendering, backend latency, database queries, bundle size, or runtime efficiency.
---

# Goal
Improve performance based on evidence while preserving correctness and user experience.

# Instructions
1. Define the performance problem, metric, budget, and user impact.
2. Measure or inspect likely bottlenecks before changing code.
3. Optimize the highest-impact layer: network, database, server compute, rendering, assets, bundle, or caching.
4. Keep changes targeted and verify the metric after implementation where possible.
5. Avoid premature complexity when simple batching, indexing, memoization, streaming, or asset optimization solves the issue.
6. Add regression tests or monitoring hooks when the risk justifies it.

# Input
Use the slow flow, traces, logs, metrics, code path, framework, and infrastructure constraints.

# Output
Generate optimized code, queries, configuration, asset handling, caching, and verification notes.

# Best Practices
- Measure before and after when feasible.
- Prefer algorithmic and query improvements over superficial memoization.
- Avoid caching sensitive or user-specific data incorrectly.
- Watch for bundle bloat, hydration cost, layout shifts, and N+1 queries.
- Keep readability unless the measured win justifies complexity.
