---
description: Capture an architecturally significant decision as an ADR
allowed-tools: Read, Write, Edit, Bash, Glob
argument-hint: <decision title>
---

Write an Architecture Decision Record for: $ARGUMENTS

Procedure:
1. Find the next free ADR number: `ls docs/adr/ | grep -E '^[0-9]{4}-' | sort | tail -1`
2. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-kebab-title.md`.
3. Fill: Context (what forced this), Decision (the choice + shape), Alternatives (≥2 with rejection reasons), Consequences (upsides + costs accepted), Reversibility.
4. Status starts `Proposed`. Reference from the PR description.

Quality bar:
- One decision per ADR.
- Alternatives section names ≥2 options seriously considered and *why rejected*.
- No project intro in Context — only the forcing function.
