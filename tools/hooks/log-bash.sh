#!/usr/bin/env bash
# Appends every bash command to the active provider bash log with UTC timestamp.
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('tool_input', {}).get('command', 'unknown'))
except Exception:
    print('unknown')
" 2>/dev/null)

ROOT="${CODEX_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
PROVIDER="${HOOK_PROVIDER:-codex}"
LOG="$ROOT/.$PROVIDER/bash.log"
mkdir -p "$(dirname "$LOG")" 2>/dev/null
printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$CMD" >> "$LOG" 2>/dev/null
exit 0
