#!/usr/bin/env bash
# Apply this harness to any project, from any AI agent.
#
# Usage (run from your project root):
#   bash <(curl -fsSL https://raw.githubusercontent.com/klaachkinggit/klaach_harness/main/apply.sh)
#
# Non-interactive (for agents):
#   TOOL=claude|codex|all  bash <(curl -fsSL .../apply.sh)
#
# Harness maintenance:
#   HARNESS_RAW_BASE=file:///path/to/klaach_harness SKIP_CODEGRAPH=1 TOOL=all bash apply.sh
#
# If your tool isn't listed: use TOOL=all, then read HARNESS.md — it maps every
# layer to the mechanism your tool uses, so you can wire it up yourself.

set -euo pipefail

REPO="klaachkinggit/klaach_harness"
RAW="${HARNESS_RAW_BASE:-https://raw.githubusercontent.com/${REPO}/main}"
RAW="${RAW%/}"

echo "=== Dev Harness — Apply ==="
echo "Target: $(pwd)"
echo ""

# ── Tool selection ────────────────────────────────────────────
if [ -z "${TOOL:-}" ]; then
  echo "Which AI coding tool?"
  echo "  1) Claude Code  2) Codex CLI  3) Both"
  read -rp "Choice [1-3]: " CHOICE
  case "$CHOICE" in
    1) TOOL="claude" ;; 2) TOOL="codex" ;; *) TOOL="all" ;;
  esac
fi

fetch() { curl -fsSL "${RAW}/$1"; }
fetch_safe() {  # fetch src → dst, backing up an existing dst first
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ -f "$dst" ]; then cp "$dst" "${dst}.bak"; echo "  backed up $dst → ${dst}.bak"; fi
  fetch "$src" > "$dst"
}
fetch_rules() {
  local src="$1" dst="$2"
  local tmp
  tmp=$(mktemp)
  fetch "$src" > "$tmp"
  mkdir -p "$(dirname "$dst")"
  if [ -f "$dst" ]; then
    cp "$dst" "${dst}.bak"
    echo "  backed up $dst → ${dst}.bak"
  fi
  python3 - "$tmp" "$dst" <<'PY'
from pathlib import Path
import sys

template_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])
template = template_path.read_text()
existing = target_path.read_text() if target_path.exists() else ""
marker = "<!-- Add project-specific rules below this line -->"

if existing and existing != template:
    tail = ""
    if marker in existing:
        tail = existing.split(marker, 1)[1].strip()
    else:
        tail = existing.strip()
    if tail and tail not in template:
        target_path.write_text(template.rstrip() + "\n\n" + tail.rstrip() + "\n")
    else:
        target_path.write_text(template)
else:
    target_path.write_text(template)
PY
  rm -f "$tmp"
  echo "  wrote $dst"
}
fetch_hooks() {
  local dir="$1"
  mkdir -p "${dir}/hooks" tools/hooks
  for h in project-scope protect-secrets block-dangerous auto-format log-bash pre-pr-gate; do
    fetch "${dir}/hooks/${h}.sh" > "${dir}/hooks/${h}.sh"; chmod +x "${dir}/hooks/${h}.sh"
    fetch "tools/hooks/${h}.sh" > "tools/hooks/${h}.sh"; chmod +x "tools/hooks/${h}.sh"
  done
}
fetch_optional() {
  local src="$1" dst="$2"
  local tmp
  tmp=$(mktemp)
  if fetch "$src" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$dst"
  else
    rm -f "$tmp"
    return 1
  fi
}
merge_json_config() {
  local src="$1" dst="$2"
  local tmp
  tmp=$(mktemp)
  fetch "$src" > "$tmp"
  mkdir -p "$(dirname "$dst")"
  if [ -f "$dst" ]; then
    cp "$dst" "${dst}.bak"
    echo "  backed up $dst → ${dst}.bak"
  fi
  python3 - "$tmp" "$dst" <<'PY'
import json
import sys
from pathlib import Path

template_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])
template = json.loads(template_path.read_text())
existing = {}
if target_path.exists() and target_path.read_text().strip():
    existing = json.loads(target_path.read_text())

managed_hook_names = {
    "auto-format.sh",
    "block-dangerous.sh",
    "log-bash.sh",
    "pre-pr-gate.sh",
    "project-scope.sh",
    "protect-secrets.sh",
}


def is_managed_hook_block(block):
    for hook in block.get("hooks", []):
        command = hook.get("command", "")
        if any(name in command for name in managed_hook_names):
            return True
    return False


merged = {
    key: value
    for key, value in existing.items()
    if key != "enabledPlugins"
}

for key, value in template.items():
    if key not in {"permissions", "hooks"}:
        merged[key] = value if key not in merged else merged[key]

permissions = dict(existing.get("permissions", {}))
for kind in ("allow", "deny"):
    seen = set(permissions.get(kind, []))
    permissions[kind] = permissions.get(kind, [])
    for item in template.get("permissions", {}).get(kind, []):
        if item not in seen:
            permissions[kind].append(item)
            seen.add(item)
if permissions:
    merged["permissions"] = permissions

hooks = dict(existing.get("hooks", {}))
for event, blocks in template.get("hooks", {}).items():
    existing_blocks = [
        block
        for block in hooks.get(event, [])
        if not is_managed_hook_block(block)
    ]
    encoded = {json.dumps(block, sort_keys=True) for block in existing_blocks}
    new_blocks = []
    for block in blocks:
        marker = json.dumps(block, sort_keys=True)
        if marker not in encoded:
            new_blocks.append(block)
            encoded.add(marker)
    hooks[event] = new_blocks + existing_blocks
if hooks:
    merged["hooks"] = hooks

target_path.write_text(json.dumps(merged, indent=2) + "\n")
PY
  rm -f "$tmp"
  echo "  wrote $dst"
}

# ── [1/6] Rules ───────────────────────────────────────────────
echo "[1/6] Rules..."
case "$TOOL" in
  claude)  fetch_rules "CLAUDE.md" "CLAUDE.md" ;;
  codex)   fetch_rules "AGENTS.md" "AGENTS.md" ;;
  all|*)   fetch_rules "CLAUDE.md" "CLAUDE.md"; fetch_rules "AGENTS.md" "AGENTS.md" ;;
esac
[ -f ".env.example" ] || fetch ".env.example" > .env.example 2>/dev/null || true
fetch_safe "APPLY.md" "APPLY.md"
fetch_safe "HARNESS.md" "HARNESS.md"
fetch_safe "PROFILES.md" "PROFILES.md"
[ -f "MEMORY.md" ] || fetch_optional "MEMORY.md" "MEMORY.md" || cat > MEMORY.md <<'EOF'
# MEMORY.md

Cross-session, append-only project memory. See `prompts/memorize.md` for what goes in and what doesn't.

---

<!-- Append entries below. Format:

## YYYY-MM-DD — short title
- Fact / decision / constraint.
- Why it matters (one line). Link: <PR / ADR / doc>.

-->
EOF
[ -f "LESSONS.md" ] || fetch_optional "LESSONS.md" "LESSONS.md" || cat > LESSONS.md <<'EOF'
# LESSONS.md

Append-only log of heuristics learned. Read at session start alongside `MEMORY.md`. See `prompts/learn.md` for what goes in.

---

<!-- Append entries below. Format:

## YYYY-MM-DD — short title  [workflow|debug|test|arch|tools|prompt|cost]
- **Saw:** what happened (one line).
- **Why:** the underlying reason it worked / failed.
- **Next time:** the heuristic future-you will actually re-read.

-->
EOF
mkdir -p docs/adr
[ -f "docs/adr/0000-template.md" ] || fetch "docs/adr/0000-template.md" > docs/adr/0000-template.md 2>/dev/null || true

# ── [2/6] Prompts (universal) ─────────────────────────────────
echo "[2/6] Prompts..."
mkdir -p prompts
for p in adopt-harness adr assess-capabilities audit cost-review diagnose grill-me \
         learn memorize preflight risk-review security-scan sparc subagent tdd to-issues zoom-out; do
  fetch "prompts/${p}.md" > "prompts/${p}.md"
done

# ── [3/6] MCP config (per-tool format) ────────────────────────
echo "[3/6] MCP config..."
mkdir -p tools
fetch "tools/gen-mcp.py" > tools/gen-mcp.py
fetch "tools/profile.py" > tools/profile.py
for t in audit-capabilities apply-profile remove-profile check-agent-context check-profile preflight-harness update-harness; do
  fetch "tools/${t}.sh" > "tools/${t}.sh"
  chmod +x "tools/${t}.sh"
done
chmod +x tools/profile.py
gen_mcp() { python3 tools/gen-mcp.py "$1"; }
case "$TOOL" in
  claude)  gen_mcp claude ;;
  codex)   gen_mcp codex ;;
  all|*)   gen_mcp claude; gen_mcp codex ;;
esac
if ! command -v uvx >/dev/null 2>&1; then
  echo "  ⚠️  uvx not found — git MCP will not start until uv is installed."
  echo "     Install uv: https://docs.astral.sh/uv/"
fi

# ── [4/6] Universal git + CI enforcement (works under ANY tool) ──
echo "[4/6] Git + CI enforcement..."
mkdir -p .githooks
for gh in pre-commit pre-push; do
  fetch ".githooks/${gh}" > ".githooks/${gh}"; chmod +x ".githooks/${gh}"
done
if ! grep -q '.env.example) continue ;;' .githooks/pre-commit; then
  perl -0pi -e 's/case "\$f" in\n/case "\$f" in\n    .env.example) continue ;;\n/' .githooks/pre-commit
fi
if [ -f ".github/workflows/ci.yml" ]; then
  echo "  kept existing .github/workflows/ci.yml; merge harness preflight manually if needed."
else
  fetch_safe ".github/workflows/ci.yml" ".github/workflows/ci.yml"
fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  EXISTING_HP=$(git config --get core.hooksPath || true)
  if [ -n "$EXISTING_HP" ] && [ "$EXISTING_HP" != ".githooks" ]; then
    echo "  ⚠️  core.hooksPath already set to '$EXISTING_HP' (husky?). NOT overriding."
    echo "     To use these instead: git config core.hooksPath .githooks"
  else
    git config core.hooksPath .githooks
    echo "  activated git hooks (core.hooksPath = .githooks)"
  fi
else
  echo "  not a git repo — run 'git init' then 'git config core.hooksPath .githooks'"
fi

# ── [5/6] Tool-specific runtime (hooks, commands, skills) ─────
echo "[5/6] Runtime extras..."

fetch_skills() {
  local dir="$1"
  for skill in find-skills ui-ux-pro-max impeccable awesome-design-md frontend-design web-design-guidelines; do
    mkdir -p "${dir}/skills/${skill}"
    fetch "${dir}/skills/${skill}/SKILL.md" > "${dir}/skills/${skill}/SKILL.md"
  done
}

setup_claude_runtime() {
  mkdir -p .claude/commands
  for c in adopt-harness adr assess-capabilities audit cost-review diagnose grill-me \
           learn memorize preflight risk-review security-scan sparc subagent tdd to-issues zoom-out; do
    fetch ".claude/commands/${c}.md" > ".claude/commands/${c}.md"
  done
  fetch_hooks ".claude"
  fetch_skills ".claude"
  merge_json_config ".claude/settings.json" ".claude/settings.json"
  echo "  Claude project runtime installed (rules+prompts+hooks+skills)."
}

setup_codex_runtime() {
  fetch_hooks ".codex"
  fetch_skills ".codex"
  merge_json_config ".codex/hooks.json" ".codex/hooks.json"
  echo "  Codex project runtime installed (rules+prompts+hooks+skills)."
  echo "  Codex hooks written to .codex/hooks.json and .codex/hooks/."
  echo "  VERIFY hook stdin field names match your Codex version — see HARNESS.md."
}

case "$TOOL" in
  claude) setup_claude_runtime ;;
  codex)  setup_codex_runtime ;;
  all)    setup_claude_runtime; setup_codex_runtime ;;
esac

# ── [6/6] CodeGraph (code graph + token saver) ───────────────
echo "[6/6] CodeGraph (code graph + token saver)..."
if [ "${SKIP_CODEGRAPH:-0}" = "1" ]; then
  echo "  skipped CodeGraph (SKIP_CODEGRAPH=1)."
elif command -v codegraph >/dev/null 2>&1; then
  if [ "${INSTALL_CODEGRAPH_MCP:-0}" = "1" ]; then
    codegraph install || true
  else
    echo "  skipped CodeGraph MCP wiring (set INSTALL_CODEGRAPH_MCP=1 to opt in)."
  fi
  codegraph init || true
  echo "  CodeGraph index built (.codegraph/)."
else
  echo "  codegraph not found. Manual setup:"
  echo "    curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh"
  echo "    Then in a new terminal: codegraph init      (builds the local .codegraph/ index)"
  echo "    Optional: INSTALL_CODEGRAPH_MCP=1 bash apply.sh to wire machine-level MCP"
  echo "  Optional but recommended: ~-47% tokens / fewer tool calls. 100% local."
fi

# ── Summary + verification ────────────────────────────────────
echo ""
echo "=== Done ==="
echo "Next: copy .env.example → .env (set GITHUB_TOKEN); add project rules at the bottom of your rules file."
echo "Profiles: add optional stack MCPs with tools/apply-profile.sh vercel|supabase|stripe|figma|all."
echo "Profiles: preview with --dry-run and remove with tools/remove-profile.sh."
echo "Skills: base is lean and project-local. Need more? Ask agent to 'find a skill for X' or see PROFILES.md."
echo "Unknown/!listed tool? Read HARNESS.md — it maps every layer to your tool's mechanism."

echo ""
echo "VERIFY:"
echo "   git config --get core.hooksPath     → should print .githooks"
echo "   ls .claude/hooks/ 2>/dev/null        → 6 scripts if Claude enabled"
echo "   ls .codex/hooks/ 2>/dev/null         → 6 scripts if Codex enabled"
echo "   tools/audit-capabilities.sh          → verify mirrors and local-only resources"
echo "   tools/check-agent-context.sh         → verify the selected agent can see harness resources"
echo "   tools/preflight-harness.sh           → blocking local harness preflight"
if { [ "$TOOL" = "claude" ] || [ "$TOOL" = "all" ]; } && command -v claude >/dev/null 2>&1; then
  echo "   claude mcp list                      → confirm servers (reads .mcp.json)"
fi
