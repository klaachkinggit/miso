#!/usr/bin/env bash
HOOK_PROVIDER=claude exec "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/tools/hooks/log-bash.sh"
