#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"

cleanup() {
  local status=$?
  if [ "$status" -eq 0 ]; then
    rm -rf "$TMP"
  else
    echo "Temp project kept for inspection: $TMP" >&2
  fi
}
trap cleanup EXIT

RAW_BASE="$(python3 - "$ROOT" <<'PY'
from pathlib import Path
import sys

print(Path(sys.argv[1]).resolve().as_uri())
PY
)"

mkdir -p "$TMP/home" "$TMP/project"
cd "$TMP/project"
git init -q
mkdir -p .codex
cat > .mcp.json <<'JSON'
{
  "mcpServers": {
    "custom-claude": {
      "command": "custom-command",
      "args": ["--custom"]
    }
  }
}
JSON
cat > .codex/config.toml <<'TOML'
[mcp_servers.custom-codex]
command = "custom-command"
args = ["--custom"]
TOML

HOME="$TMP/home" TOOL=all HARNESS_RAW_BASE="$RAW_BASE" SKIP_CODEGRAPH=1 bash "$ROOT/apply.sh" >/dev/null

test "$(git config --get core.hooksPath)" = ".githooks"
test -f AGENTS.md
test -f CLAUDE.md
test -f .mcp.json
test -f .codex/config.toml
test -x tools/apply-profile.sh
test -x tools/remove-profile.sh
test -x tools/audit-capabilities.sh
test -x .claude/hooks/project-scope.sh
test -x .codex/hooks/project-scope.sh
grep -q '"custom-claude"' .mcp.json
grep -q '^\[mcp_servers.custom-codex\]' .codex/config.toml

printf '{"tool_input":{"file_path":"%s/AGENTS.md"}}' "$PWD" | .claude/hooks/project-scope.sh
printf '{"tool_input":{"command":"curl https://example.com"}}' | .codex/hooks/project-scope.sh
set +e
printf '{"tool_input":{"file_path":"%s/.ssh/config"}}' "$HOME" | .claude/hooks/project-scope.sh >/dev/null 2>&1
claude_scope_status=$?
printf '{"tool_input":{"command":"ls %s"}}' "$HOME" | .codex/hooks/project-scope.sh >/dev/null 2>&1
codex_scope_status=$?
set -e
test "$claude_scope_status" -eq 2
test "$codex_scope_status" -eq 2

HOME="$TMP/home" tools/apply-profile.sh all >/dev/null
before="$(cksum .mcp.json .codex/config.toml)"
HOME="$TMP/home" tools/apply-profile.sh supabase --dry-run >/dev/null
after="$(cksum .mcp.json .codex/config.toml)"
test "$before" = "$after"
HOME="$TMP/home" tools/remove-profile.sh stripe >/dev/null
! grep -q '"stripe"' .mcp.json
! grep -q '^\[mcp_servers.stripe\]' .codex/config.toml
grep -q '"custom-claude"' .mcp.json
grep -q '^\[mcp_servers.custom-codex\]' .codex/config.toml
remove_before="$(cksum .mcp.json .codex/config.toml)"
HOME="$TMP/home" tools/remove-profile.sh figma --dry-run >/dev/null
remove_after="$(cksum .mcp.json .codex/config.toml)"
test "$remove_before" = "$remove_after"
HOME="$TMP/home" tools/apply-profile.sh stripe >/dev/null
HOME="$TMP/home" tools/audit-capabilities.sh --expect-profile all >/dev/null

python3 -m json.tool .mcp.json >/dev/null
python3 -m json.tool .codex/hooks.json >/dev/null
grep -q '^\[mcp_servers.vercel\]' .codex/config.toml
grep -q '^\[mcp_servers.supabase\]' .codex/config.toml
grep -q '^\[mcp_servers.stripe\]' .codex/config.toml
grep -q '^\[mcp_servers.figma\]' .codex/config.toml

echo "Temp-project harness integration passed."
