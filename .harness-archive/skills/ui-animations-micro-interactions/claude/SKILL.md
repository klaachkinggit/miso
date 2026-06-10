---
name: ui-animations-micro-interactions
description: Use this skill when performing UI animations and micro-interactions for frontend interfaces.
---

# Goal
Add motion that clarifies state, improves perceived quality, and creates memorable interaction without hurting performance or accessibility.

# Instructions
1. Define the purpose of each animation: orientation, feedback, hierarchy, delight, or continuity.
2. Prefer CSS transitions/keyframes for simple UI motion; use the project's animation library for coordinated or gesture-driven motion.
3. Animate transform and opacity when possible; avoid layout-heavy properties for frequent motion.
4. Create consistent durations, easing, delays, and choreography through tokens or shared constants.
5. Add reduced-motion fallbacks for users who request less motion.
6. Verify the animation in-browser for timing, jank, focus behavior, and layout stability.

# Input
Use the interface state changes, aesthetic direction, framework, existing animation libraries, and performance constraints.

# Output
Generate animation CSS, component motion logic, interaction states, and reduced-motion support.

# Best Practices
- Do not animate essential content in a way that blocks task completion.
- Keep hover/focus animations responsive and reversible.
- Avoid infinite animation unless it communicates live status or ambiance with restraint.
- Use staggered reveals for important page-entry moments.
- Test keyboard and touch interactions, not only mouse hover.
