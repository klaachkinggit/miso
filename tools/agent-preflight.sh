#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

printf 'Agent preflight for %s\n' "$ROOT"
printf 'Branch: %s\n' "$(git branch --show-current 2>/dev/null || printf 'unknown')"

npm run agent:check-repo

if [ -n "$(git status --short)" ]; then
  git status --short
  fail "worktree is dirty before editing; resolve, commit, stash, or explicitly acknowledge before continuing"
fi

printf 'PASS: agent preflight\n'
