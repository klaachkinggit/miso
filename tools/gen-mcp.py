#!/usr/bin/env python3
"""Generate MCP server config in the right format/location for a given tool.

One source of truth (SERVERS) → per-tool emitters. Adding a new tool = one function.

Usage:
    python3 tools/gen-mcp.py <tool>
    tool ∈ {claude, codex}

Project-scoped configs (claude, codex) are WRITTEN to the repo.

Env vars: GITHUB_TOKEN (required for github), DATABASE_URL (optional → adds db server).
"""
import json
import os
import sys

# ── Single source of truth ────────────────────────────────────
# env: name of the environment variable this server needs (or None).
SERVERS = [
    {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": "GITHUB_TOKEN",
        "env_key": "GITHUB_PERSONAL_ACCESS_TOKEN",
    },
    {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
        "env": None,
    },
    {
        "name": "git",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "."],
        "env": None,
    },
    {
        "name": "playwright",
        "command": "npx",
        "args": ["-y", "@playwright/mcp"],
        "env": None,
    },
    {
        "name": "sequential-thinking",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        "env": None,
    },
]

if os.environ.get("DATABASE_URL"):
    SERVERS.append(
        {
            "name": "db",
            "command": "npx",
            "args": ["-y", "@bytebase/dbhub", "--dsn", os.environ["DATABASE_URL"]],
            "env": None,
        }
    )


def _json_servers(var_syntax):
    """Build the mcpServers dict. var_syntax formats an env var name into a placeholder."""
    out = {}
    for s in SERVERS:
        entry = {"command": s["command"], "args": list(s["args"])}
        if s["env"]:
            entry["env"] = {s["env_key"]: var_syntax(s["env"])}
        out[s["name"]] = entry
    return {"mcpServers": out}


def emit_claude():
    cfg = _json_servers(lambda v: "${%s}" % v)  # Claude: ${VAR}
    _write(".mcp.json", json.dumps(cfg, indent=2))


def emit_codex():
    # Codex: TOML, no ${} interpolation. Secrets are forwarded by NAME via env_vars.
    lines = []
    for s in SERVERS:
        lines.append("[mcp_servers.%s]" % s["name"])
        lines.append("command = %s" % json.dumps(s["command"]))
        lines.append("args = %s" % json.dumps(s["args"]))
        if s["env"]:
            # Forward the named env var from the surrounding shell into the server.
            lines.append('env_vars = ["%s"]' % s["env"])
        lines.append("")
    os.makedirs(".codex", exist_ok=True)
    body = "\n".join(lines)
    # Append to .codex/config.toml if present, else create.
    path = ".codex/config.toml"
    existing = ""
    if os.path.exists(path):
        with open(path) as f:
            existing = f.read()
        if "[mcp_servers." in existing:
            print(
                "  %s already has mcp_servers — printing block to merge manually:\n"
                % path
            )
            print(body)
            return
    with open(path, "w") as f:
        f.write((existing + "\n" if existing else "") + body)
    print("  wrote %s" % path)


def _write(path, content):
    with open(path, "w") as f:
        f.write(content + "\n")
    print("  wrote %s" % path)


EMITTERS = {
    "claude": emit_claude,
    "codex": emit_codex,
}

if __name__ == "__main__":
    tool = (sys.argv[1] if len(sys.argv) > 1 else "").lower()
    if tool not in EMITTERS:
        print("Usage: gen-mcp.py <%s>" % "|".join(EMITTERS), file=sys.stderr)
        sys.exit(1)
    if not os.environ.get("GITHUB_TOKEN"):
        print(
            "  note: GITHUB_TOKEN not set — github MCP will fail until you set it in .env",
            file=sys.stderr,
        )
    EMITTERS[tool]()
