---
description: Periodic repo health check — test gaps, dead code, drift, hot files
allowed-tools: Bash, Read, Grep, Glob
argument-hint: (optional) since=<duration> e.g. 14.days
---

Run a repo health audit. Window: $ARGUMENTS (default 14.days).

Checks (report each as a punch list, no auto-fixes):

1. **Test gaps** — recently changed source files with no matching test edit.
2. **Dead code** — `npx ts-prune` / `vulture` / `staticcheck -checks U1000` / `cargo +nightly udeps` per language.
3. **Dependency drift** — `npm outdated` / `pip list --outdated` / `cargo outdated`; vuln scan `npm audit --audit-level=high`.
4. **TODO age** — `git grep -nE 'TODO|FIXME|HACK'` with last-commit-age per file. Flag >90 days.
5. **Hot files** — top 20 by churn (`git log --since=90.days --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20`).
6. **CI red-streak** — `gh run list --limit 30 --json conclusion,workflowName` grouped by workflow.

Output: a markdown report grouped by check. For each finding: file/line, age, suggested action. **Do not auto-fix.** If follow-up work is warranted, hand to `/to-issues`.
