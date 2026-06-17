#!/usr/bin/env bash
# Blocks file and shell access outside the current project. Exit 2 = hard block.
INPUT=$(cat)

INPUT_JSON="$INPUT" python3 - <<'PY'
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path


def project_root():
    for key in ("CLAUDE_PROJECT_DIR", "CODEX_PROJECT_DIR"):
        value = os.environ.get(key)
        if value:
            return Path(value).expanduser().resolve()
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        if out:
            return Path(out).resolve()
    except Exception:
        pass
    return Path.cwd().resolve()


ROOT = project_root()
ALLOWED_DEVICES = {"/dev/null", "/dev/tty", "/dev/stdin", "/dev/stdout", "/dev/stderr"}
SYSTEM_EXEC_PREFIXES = ("/bin/", "/usr/bin/", "/usr/local/bin/", "/opt/homebrew/bin/")


def expand_path(raw):
    raw = raw.strip()
    if not raw:
        return None
    if raw.startswith(("http://", "https://", "ssh://", "git@", "mailto:")):
        return None
    if raw in ALLOWED_DEVICES:
        return Path(raw)
    raw = os.path.expandvars(os.path.expanduser(raw))
    p = Path(raw)
    if not p.is_absolute():
        p = ROOT / p
    try:
        return p.resolve(strict=False)
    except Exception:
        return p.absolute()


def inside_root(path):
    if str(path) in ALLOWED_DEVICES:
        return True
    try:
        return os.path.commonpath([str(ROOT), str(path)]) == str(ROOT)
    except ValueError:
        return False


def block(label, value):
    print(f"BLOCKED: outside project {label} — {value}", file=sys.stderr)
    sys.exit(2)


def check_path(raw, label="path"):
    path = expand_path(raw)
    if path is None:
        return
    if not inside_root(path):
        block(label, raw)


try:
    payload = json.loads(os.environ.get("INPUT_JSON", "{}") or "{}")
except Exception:
    sys.exit(0)

tool_input = payload.get("tool_input", {}) or {}

for key in ("file_path", "path"):
    value = tool_input.get(key)
    if isinstance(value, str) and value:
        check_path(value, key)

command = tool_input.get("command", "")
if not isinstance(command, str) or not command:
    sys.exit(0)

try:
    tokens = shlex.split(command)
except ValueError:
    tokens = command.split()

for idx, token in enumerate(tokens):
    if not token or token in {"|", "||", "&&", ";", ">", ">>", "<", "2>", "2>>"}:
        continue
    if token.startswith(("http://", "https://", "ssh://", "git@")):
        continue
    if idx == 0 and token.startswith(SYSTEM_EXEC_PREFIXES):
        continue
    candidates = [token]
    if "=" in token:
        candidates.append(token.split("=", 1)[1])
    for candidate in candidates:
        if candidate.startswith(("/", "~", "./", "../")) or candidate in {".", ".."}:
            check_path(candidate, "shell path")

for match in re.finditer(r"(?<![A-Za-z0-9+:])/(?:Users|home|private|etc|var|tmp|Volumes|Library)[^\s'\";|&<>()]*", command):
    check_path(match.group(0), "shell path")

sys.exit(0)
PY
