# Lessons

Heuristics from past sessions. Append-only; only write a lesson if it has a "next time" rule.

## 2026-06-12 - Recover workflow results from disk before re-running
Background workflow agents killed by session limits lose their run, but every completed agent's result persists in `/private/tmp/claude-*/…/tasks/*.output` (JSON with `result` key). Resume-from-runId returned zero cache hits after a hard kill. Next time: inventory the tasks output dir and extract completed results before re-running anything; re-run only the missing agents.

## 2026-06-12 - Parallel builders need a layer-aware test reviewer
A builder agent asserting error *types* picked the wrong layer: in the publish path, the compliance gate (plain Errors) is a superset that fires before `assertPayoutReady`'s typed errors, making them unreachable there. Next time: when a test asserts which error type a multi-gate path throws, trace gate ordering first and pin typed-error contracts at the layer that actually throws them.

## 2026-06-12 - Authorize against server-derived ownership, not form ids
A generated server action gated on the form's `event_id` while operating on an unrelated `payment_id` — classic IDOR. Next time: for any action taking two ids (scope + target), derive the target's true scope server-side and authorize against that; treat the form's scope id as display/redirect only.

## 2026-06-13 - Pipe-masked exit codes
`npm run build 2>&1 | tail` reports tail's exit code, not the build's — a fake "build PASS" survived a whole session. Next time: `set -o pipefail` in every verification command that pipes output.

## 2026-06-13 - Verify subagent claims against git, not prose
A verify agent confidently reported a route rename that never happened and misattributed a build failure. Next time: before acting on a subagent's claim about repo state, check `git status`/`git log` or rerun the command yourself — it costs seconds.
