#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

has_script() {
  node -e '
const pkg = require("./package.json");
process.exit(pkg.scripts && pkg.scripts[process.argv[1]] ? 0 : 1);
' "$1"
}

printf 'Checking whitespace in Git diffs...\n'
git diff --check

printf 'Checking repo contract...\n'
npm run agent:check-repo

printf 'Checking installed package tree...\n'
package_tree="$(npm ls --depth=0 2>&1)"
printf '%s\n' "$package_tree"
if printf '%s\n' "$package_tree" | grep -E ' (extraneous|missing|invalid|unmet)($| )' >/dev/null; then
  printf 'FAIL: npm package tree has install-health warnings\n' >&2
  exit 1
fi

printf 'Running high-severity dependency audit...\n'
npm audit --audit-level=high

printf 'Running TypeScript...\n'
npm run typecheck

printf 'Running lint...\n'
npm run lint

if has_script test:unit; then
  printf 'Running unit tests...\n'
  npm run test:unit
elif has_script test; then
  printf 'Running tests...\n'
  npm test
else
  printf 'WARN: no test or test:unit script is defined; skipping automated tests.\n'
fi

printf 'Running production build...\n'
npm run build

printf 'PASS: agent verification\n'
