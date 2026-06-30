#!/usr/bin/env bash
HOOK_PROVIDER=codex exec "${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/tools/hooks/project-scope.sh"
