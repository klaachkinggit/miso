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
fetch_hooks() {
  local dir="$1"
  mkdir -p "${dir}/hooks"
  for h in project-scope protect-secrets block-dangerous auto-format log-bash pre-pr-gate; do
    fetch "${dir}/hooks/${h}.sh" > "${dir}/hooks/${h}.sh"; chmod +x "${dir}/hooks/${h}.sh"
  done
}

# ── [1/6] Rules ───────────────────────────────────────────────
echo "[1/6] Rules..."
case "$TOOL" in
  claude)  fetch_safe "CLAUDE.md" "CLAUDE.md" ;;
  codex)   fetch_safe "AGENTS.md" "AGENTS.md" ;;
  all|*)   fetch_safe "CLAUDE.md" "CLAUDE.md"; fetch_safe "AGENTS.md" "AGENTS.md" ;;
esac
[ -f ".env.example" ] || fetch ".env.example" > .env.example 2>/dev/null || true

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
for t in audit-capabilities apply-profile remove-profile; do
  fetch "tools/${t}.sh" > "tools/${t}.sh"
  chmod +x "tools/${t}.sh"
done
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
fetch_safe ".github/workflows/ci.yml" ".github/workflows/ci.yml"
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
  fetch_safe ".claude/settings.json" ".claude/settings.json"
  echo "  Claude project runtime installed (rules+prompts+hooks+skills)."
}

setup_codex_runtime() {
  fetch_hooks ".codex"
  fetch_skills ".codex"
  fetch_safe ".codex/hooks.json" ".codex/hooks.json"
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
  codegraph install || true
  codegraph init || true
  echo "  CodeGraph installed and index built (.codegraph/)."
else
  echo "  codegraph not found. Manual setup:"
  echo "    curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh"
  echo "    Then in a new terminal: codegraph install   (auto-wires Claude Code + Codex MCP)"
  echo "    Then: codegraph init                        (builds the local .codegraph/ index)"
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
if { [ "$TOOL" = "claude" ] || [ "$TOOL" = "all" ]; } && command -v claude >/dev/null 2>&1; then
  echo "   claude mcp list                      → confirm servers (reads .mcp.json)"
fi
