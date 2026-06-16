# Lessons

Heuristics from past sessions. Append-only; only write a lesson if it has a "next time" rule.

## 2026-06-12 - Recover workflow results from disk before re-running

Background workflow agents killed by session limits lose their run, but every completed agent's result persists in `/private/tmp/claude-*/…/tasks/*.output` (JSON with `result` key). Resume-from-runId returned zero cache hits after a hard kill. Next time: inventory the tasks output dir and extract completed results before re-running anything; re-run only the missing agents.

## 2026-06-12 - Parallel builders need a layer-aware test reviewer

A builder agent asserting error _types_ picked the wrong layer: in the publish path, the compliance gate (plain Errors) is a superset that fires before `assertPayoutReady`'s typed errors, making them unreachable there. Next time: when a test asserts which error type a multi-gate path throws, trace gate ordering first and pin typed-error contracts at the layer that actually throws them.

## 2026-06-12 - Authorize against server-derived ownership, not form ids

A generated server action gated on the form's `event_id` while operating on an unrelated `payment_id` — classic IDOR. Next time: for any action taking two ids (scope + target), derive the target's true scope server-side and authorize against that; treat the form's scope id as display/redirect only.

## 2026-06-13 - Pipe-masked exit codes

`npm run build 2>&1 | tail` reports tail's exit code, not the build's — a fake "build PASS" survived a whole session. Next time: `set -o pipefail` in every verification command that pipes output.

## 2026-06-13 - Verify subagent claims against git, not prose

A verify agent confidently reported a route rename that never happened and misattributed a build failure. Next time: before acting on a subagent's claim about repo state, check `git status`/`git log` or rerun the command yourself — it costs seconds.

## 2026-06-15 - macOS has no `timeout`; bound commands with the Bash tool timeout

A background workflow stalled ~85 min after `timeout 150 npm install …` hit `command not found` (darwin ships no `timeout`/`gtimeout`), so the guard no-op'd (exit 127) and a later long command ran unbounded. Next time: never rely on shell `timeout` on macOS — set the Bash tool's own `timeout` param (it kills the process), or install coreutils first.

## 2026-06-15 - Pre-stage fragile infra inline; give workflow agents writes only

The same 85-min stall came from a build agent running `npm install --legacy-peer-deps` + `supabase db reset` + `npm run build` itself. Doing all serial/fragile infra (deps, migration+reset, types regen, rate-limit bucket) inline in the main thread FIRST, then fanning out a Workflow whose agents ONLY write files (explicitly forbidden from install/build/db-reset), removed the stall and the AI feature built clean. Next time: scout/stage infra inline, delegate only file authoring to parallel agents, run typecheck/lint/build/tests yourself afterward.

## 2026-06-16 - Visual QA should include glossary scan

A storefront screenshot exposed buyer-facing "NFT tickets" copy even though implementation tests were green and the domain glossary forbids that term. Next time: when visually auditing public UI, scan rendered copy against `docs/CONTEXT.md` terms-to-avoid before final verification.

## 2026-06-16 - Keep visual QA when the MCP browser is locked

Playwright MCP can fail with a locked browser profile if another session owns the shared cache. Next time: run the repo's Playwright package directly with a fresh headless browser/context and save screenshots, instead of dropping the browser check.
