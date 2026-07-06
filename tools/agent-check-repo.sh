#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_file() {
  test -f "$1" || fail "$1 is missing"
}

printf 'Checking agent repo contract...\n'

require_file package.json
require_file package-lock.json
require_file README.md
require_file AGENTS.md
require_file docs/CONTEXT.md
require_file docs/AGENT_WORKFLOW.md
require_file .env.example
require_file .gitignore
require_file .vercelignore

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  fail ".env is tracked; move secrets to local-only files and templates to .env.example"
fi

tracked_local_artifacts="$(
  git ls-files \
    '.next/*' 'node_modules/*' '.vercel/*' '.codegraph/*' '.agents/*' '.claude/*' \
    'coverage/*' 'playwright-report/*' 'test-results/*' 'out/*' 'dist/*' 'build/*' \
    2>/dev/null || true
)"
if [ -n "$tracked_local_artifacts" ]; then
  printf '%s\n' "$tracked_local_artifacts" >&2
  fail "local/generated artifacts are tracked"
fi

tracked_stale_artifacts="$(
  git ls-files | grep -E '(^|/)([^/]*\.(bak|tmp|orig|rej)|.*~|.*\.old|.*\.backup|report.*\.md|.*handoff.*\.md)$' || true
)"
if [ -n "$tracked_stale_artifacts" ]; then
  printf '%s\n' "$tracked_stale_artifacts" >&2
  fail "tracked stale report/backup/handoff artifacts need explicit ownership"
fi

for path in .env .env.local .next/ node_modules/ .vercel/ .codegraph/ .agents/ .claude/ .codex/sessions/ coverage/ playwright-report/ test-results/ out/ dist/ build/; do
  git check-ignore -q "$path" || fail "$path is not ignored"
done

for path in .codegraph/ .agents/ .codex/ .claude/ .next/ node_modules/; do
  grep -qxF "$path" .vercelignore || fail ".vercelignore must exclude $path"
done

node -e '
const fs = require("fs");
const pkg = require("./package.json");
const required = [
  "typecheck",
  "lint",
  "build",
  "agent:check-repo",
  "agent:preflight",
  "agent:verify",
  "agent:finish",
];
const missing = required.filter((name) => !pkg.scripts || !pkg.scripts[name]);
if (missing.length) {
  console.error(`Missing package scripts: ${missing.join(", ")}`);
  process.exit(1);
}
for (const file of [".codex/hooks.json", "package-lock.json"]) {
  if (fs.existsSync(file)) JSON.parse(fs.readFileSync(file, "utf8"));
}
'

for script in tools/agent-check-repo.sh tools/agent-preflight.sh tools/agent-verify.sh tools/agent-finish.sh; do
  test -x "$script" || fail "$script must be executable"
  bash -n "$script"
done

if [ ! -d .codegraph ]; then
  printf 'WARN: no .codegraph/ index present; skip CodeGraph for this checkout\n'
fi

printf 'PASS: agent repo contract\n'
