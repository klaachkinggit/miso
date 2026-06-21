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
cat > AGENTS.md <<'MD'
# Existing Codex Rules

## Project: sentinel-codex
- Keep this Codex project rule.
MD
cat > CLAUDE.md <<'MD'
# Existing Claude Rules

## Project: sentinel-claude
- Keep this Claude project rule.
MD
mkdir -p .claude .codex
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
cat > .claude/settings.json <<'JSON'
{
  "permissions": {
    "allow": ["Bash(custom:*)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "CustomTool",
        "hooks": [
          {
            "type": "command",
            "command": "echo custom-claude"
          }
        ]
      }
    ]
  },
  "customSetting": true
}
JSON
cat > .codex/hooks.json <<'JSON'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^CustomTool$",
        "hooks": [
          {
            "type": "command",
            "command": "echo custom-codex"
          }
        ]
      }
    ]
  },
  "customSetting": true
}
JSON

HOME="$TMP/home" TOOL=all HARNESS_RAW_BASE="$RAW_BASE" SKIP_CODEGRAPH=1 bash "$ROOT/apply.sh" >/dev/null

test "$(git config --get core.hooksPath)" = ".githooks"
test -f AGENTS.md
test -f CLAUDE.md
grep -q 'sentinel-codex' AGENTS.md
grep -q 'sentinel-claude' CLAUDE.md
test -f APPLY.md
test -f HARNESS.md
test -f PROFILES.md
test -f MEMORY.md
test -f LESSONS.md
test -f docs/adr/0000-template.md
test -f .mcp.json
test -f .codex/config.toml
grep -q '"context7"' .mcp.json
grep -q '^\[mcp_servers.context7\]' .codex/config.toml
test -x tools/apply-profile.sh
test -x tools/remove-profile.sh
test -x tools/audit-capabilities.sh
test -x tools/check-agent-context.sh
test -x tools/check-profile.sh
test -x tools/preflight-harness.sh
test -x tools/update-harness.sh
test -x .claude/hooks/project-scope.sh
test -x .codex/hooks/project-scope.sh
grep -q '"custom-claude"' .mcp.json
grep -q '^\[mcp_servers.custom-codex\]' .codex/config.toml
grep -q 'custom-claude' .claude/settings.json
grep -q 'custom-codex' .codex/hooks.json
grep -q 'project-scope.sh' .claude/settings.json
grep -q 'project-scope.sh' .codex/hooks.json
! grep -R "test-harness-integration.sh" .github/workflows >/dev/null 2>&1

HOME="$TMP/home" tools/check-agent-context.sh --tool all >/dev/null
HOME="$TMP/home" tools/check-profile.sh >/dev/null
HOME="$TMP/home" tools/preflight-harness.sh >/dev/null

printf '{"tool_input":{"file_path":"%s/AGENTS.md"}}' "$PWD" | .claude/hooks/project-scope.sh
printf '{"tool_input":{"command":"curl https://example.com"}}' | .codex/hooks/project-scope.sh
mkdir -p local/generated
printf '{"tool_input":{"command":"touch $(pwd)/local/generated/file.txt"}}' | .codex/hooks/project-scope.sh
printf '{"tool_input":{"file_path":".env.example"}}' | .claude/hooks/protect-secrets.sh
printf '{"tool_input":{"command":"cat .env.example"}}' | .codex/hooks/block-dangerous.sh
printf '{"tool_input":{"command":"printf FOO=bar > .env.example"}}' | .codex/hooks/block-dangerous.sh
printf '{"tool_input":{"file_path":".codex/hooks/protect-secrets.sh"}}' | .claude/hooks/protect-secrets.sh
ln -s "$HOME" home-link
set +e
printf '{"tool_input":{"file_path":"%s/.ssh/config"}}' "$HOME" | .claude/hooks/project-scope.sh >/dev/null 2>&1
claude_scope_status=$?
printf '{"tool_input":{"command":"ls %s"}}' "$HOME" | .codex/hooks/project-scope.sh >/dev/null 2>&1
codex_scope_status=$?
printf '{"tool_input":{"file_path":"home-link/.ssh/config"}}' | .claude/hooks/project-scope.sh >/dev/null 2>&1
symlink_scope_status=$?
printf '{"tool_input":{"command":"cat $HOME/.ssh/config"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
home_var_status=$?
printf '{"tool_input":{"cmd":"cat $HOME/.ssh/config"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
cmd_alias_status=$?
printf '%s' '{"tool_input":{"command":"cat \"$HOME\"/*"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
home_glob_status=$?
printf '%s' '{"tool_input":{"command":"cat \"../outside path/secret.txt\""}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
space_path_status=$?
printf '{"tool_input":{"command":"cat ~/Desktop/*"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
glob_status=$?
printf '{"tool_input":{"command":"cat $(pwd)/../outside.txt"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
subshell_status=$?
printf '{"tool_input":{"command":"cat $(whoami)/file.txt"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
unsafe_subshell_status=$?
printf '{"tool_input":{"command":"cat home-link/*"}}' | .codex/hooks/project-scope.sh >/dev/null 2>&1
symlink_glob_status=$?
set -e
test "$claude_scope_status" -eq 2
test "$codex_scope_status" -eq 2
test "$symlink_scope_status" -eq 2
test "$home_var_status" -eq 2
test "$cmd_alias_status" -eq 2
test "$home_glob_status" -eq 2
test "$space_path_status" -eq 2
test "$glob_status" -eq 2
test "$subshell_status" -eq 2
test "$unsafe_subshell_status" -eq 2
test "$symlink_glob_status" -eq 2

printf 'SECRET=1\n' > .env
printf 'KEY=1\n' > private.key
ln -s .env safe.txt
set +e
printf '{"tool_input":{"command":"cat .env"}}' | .codex/hooks/block-dangerous.sh >/dev/null 2>&1
bash_env_status=$?
printf '{"tool_input":{"cmd":"cat private.key"}}' | .codex/hooks/block-dangerous.sh >/dev/null 2>&1
bash_key_status=$?
printf '{"tool_input":{"file_path":"safe.txt"}}' | .claude/hooks/protect-secrets.sh >/dev/null 2>&1
secret_symlink_status=$?
printf '{"tool_input":{"filepath":"%s/.ssh/config"}}' "$HOME" | .codex/hooks/project-scope.sh >/dev/null 2>&1
filepath_alias_status=$?
set -e
test "$bash_env_status" -eq 2
test "$bash_key_status" -eq 2
test "$secret_symlink_status" -eq 2
test "$filepath_alias_status" -eq 2

cat > package.json <<'JSON'
{
  "name": "harness-profile-test",
  "private": true,
  "dependencies": {
    "left-pad": "^1.3.0"
  }
}
JSON
HOME="$TMP/home" tools/apply-profile.sh ponytail >/dev/null
grep -q '"ponytail": "\^1.0.57"' package.json
HOME="$TMP/home" tools/check-profile.sh ponytail >/dev/null
HOME="$TMP/home" tools/remove-profile.sh ponytail >/dev/null
! grep -q '"ponytail"' package.json
grep -q '"left-pad": "\^1.3.0"' package.json

HOME="$TMP/home" STRIPE_SECRET_KEY=sk_test_placeholder tools/apply-profile.sh all >/dev/null
HOME="$TMP/home" STRIPE_SECRET_KEY=sk_test_placeholder tools/check-profile.sh all >/dev/null
HOME="$TMP/home" STRIPE_SECRET_KEY=sk_test_placeholder tools/apply-profile.sh all >/dev/null
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
HOME="$TMP/home" tools/remove-profile.sh all >/dev/null
! grep -Eq '"(vercel|supabase|stripe|figma)"' .mcp.json
! grep -Eq '^\[mcp_servers\.(vercel|supabase|stripe|figma)\]' .codex/config.toml
grep -q '"custom-claude"' .mcp.json
grep -q '^\[mcp_servers.custom-codex\]' .codex/config.toml
HOME="$TMP/home" STRIPE_SECRET_KEY=sk_test_placeholder tools/apply-profile.sh all >/dev/null
HOME="$TMP/home" tools/audit-capabilities.sh --expect-profile all --check-user-resources >/dev/null

python3 -m json.tool .mcp.json >/dev/null
python3 -m json.tool .codex/hooks.json >/dev/null
grep -q '^\[mcp_servers.vercel\]' .codex/config.toml
grep -q '^\[mcp_servers.supabase\]' .codex/config.toml
grep -q '^\[mcp_servers.stripe\]' .codex/config.toml
grep -q '^\[mcp_servers.figma\]' .codex/config.toml

mkdir -p "$TMP/no-curl-project"
cd "$TMP/no-curl-project"
git init -q
HOME="$TMP/home" TOOL=all HARNESS_RAW_BASE="$RAW_BASE" SKIP_CODEGRAPH=1 bash "$ROOT/apply.sh" >/dev/null
test -f AGENTS.md
test -f CLAUDE.md
test -x tools/preflight-harness.sh
test ! -d klaach_harness
test ! -d .harness-archive
HOME="$TMP/home" tools/check-agent-context.sh --tool all >/dev/null

echo "Temp-project harness integration passed."
