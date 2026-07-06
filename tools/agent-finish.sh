#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run agent:verify

if [ -n "$(git status --short)" ]; then
  printf 'FAIL: worktree is dirty. Commit verified work or explicitly hand off the dirty state.\n' >&2
  git status --short >&2
  exit 1
fi

printf 'PASS: finish gate; worktree is clean\n'
