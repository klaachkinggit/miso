#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse


def supabase_url():
    query = {"read_only": "true"}
    if os.environ.get("SUPABASE_PROJECT_REF"):
        query["project_ref"] = os.environ["SUPABASE_PROJECT_REF"]
    if os.environ.get("SUPABASE_MCP_FEATURES"):
        query["features"] = os.environ["SUPABASE_MCP_FEATURES"]
    return "https://mcp.supabase.com/mcp?" + urlencode(query)


def servers():
    return {
        "vercel": {
            "claude": {"type": "http", "url": "https://mcp.vercel.com"},
            "codex": {"url": "https://mcp.vercel.com"},
        },
        "supabase": {
            "claude": {"type": "http", "url": supabase_url()},
            "codex": {"url": supabase_url()},
        },
        "stripe": {
            "claude": {
                "type": "stdio",
                "command": "npx",
                "args": ["-y", "@stripe/mcp@latest"],
                "env": {"STRIPE_SECRET_KEY": "$STRIPE_SECRET_KEY"},
            },
            "codex": {
                "command": "npx",
                "args": ["-y", "@stripe/mcp@latest"],
                "env_vars": ["STRIPE_SECRET_KEY"],
            },
        },
        "figma": {
            "claude": {"type": "http", "url": "https://mcp.figma.com/mcp"},
            "codex": {"url": "https://mcp.figma.com/mcp"},
        },
    }


MCP_PROFILES = servers()
PACKAGE_PROFILES = {"ponytail": {"dependency": "ponytail", "version": "^1.0.57"}}
KNOWN = sorted([*MCP_PROFILES, *PACKAGE_PROFILES])


def profile_names(name):
    if name == "all":
        return sorted(MCP_PROFILES)
    if name in MCP_PROFILES:
        return [name]
    sys.exit("unknown profile: %s\nknown profiles: %s, all" % (name, ", ".join(KNOWN)))


def package_profile_names(name):
    if name == "all":
        return sorted(PACKAGE_PROFILES)
    if name in PACKAGE_PROFILES:
        return [name]
    if name in MCP_PROFILES:
        return []
    sys.exit("unknown profile: %s\nknown profiles: %s, all" % (name, ", ".join(KNOWN)))


def read_claude():
    path = Path(".mcp.json")
    if not path.exists() or not path.read_text().strip():
        return {"mcpServers": {}}
    cfg = json.loads(path.read_text())
    cfg.setdefault("mcpServers", {})
    return cfg


def codex_without(names):
    path = Path(".codex/config.toml")
    kept, lines, i = [], path.read_text().splitlines() if path.exists() else [], 0
    while i < len(lines):
        match = re.match(r"\[mcp_servers\.([^\]]+)\]", lines[i])
        if match and match.group(1) in names:
            i += 1
            while i < len(lines) and not lines[i].startswith("["):
                i += 1
            continue
        kept.append(lines[i])
        i += 1
    return "\n".join(kept).rstrip()


def codex_block(name, entry):
    lines = ["[mcp_servers.%s]" % name]
    if "url" in entry:
        lines.append("url = " + json.dumps(entry["url"]))
    else:
        lines += [
            "command = " + json.dumps(entry["command"]),
            "args = " + json.dumps(entry["args"]),
        ]
        if entry.get("env_vars"):
            lines.append("env_vars = " + json.dumps(entry["env_vars"]))
    return "\n".join(lines)


def mutate(args, action):
    profile = args.profile.lower()
    names = (
        profile_names(profile) if profile in MCP_PROFILES or profile == "all" else []
    )
    packages = package_profile_names(profile)
    if names and args.tool in ("claude", "all"):
        cfg = read_claude()
        for name in names:
            if action == "apply":
                cfg["mcpServers"][name] = MCP_PROFILES[name]["claude"]
            else:
                cfg["mcpServers"].pop(name, None)
        if args.dry_run:
            print("DRY RUN .mcp.json")
            print(json.dumps(cfg, indent=2))
        else:
            Path(".mcp.json").write_text(json.dumps(cfg, indent=2) + "\n")
            print("  wrote .mcp.json")
    if names and args.tool in ("codex", "all"):
        base = codex_without(set(names))
        blocks = (
            []
            if action == "remove"
            else [codex_block(n, MCP_PROFILES[n]["codex"]) for n in names]
        )
        body = "\n\n".join(
            part for part in [base, "\n\n".join(blocks)] if part.strip()
        ).rstrip()
        if args.dry_run:
            print("DRY RUN .codex/config.toml")
            print(body)
        else:
            Path(".codex").mkdir(exist_ok=True)
            Path(".codex/config.toml").write_text((body + "\n") if body else "")
            print("  wrote .codex/config.toml")
    if packages and (Path("package.json").exists() or profile != "all"):
        mutate_packages(packages, action, args.dry_run)


def read_package_json():
    path = Path("package.json")
    if not path.exists():
        raise SystemExit(
            "package.json missing; package profiles require a package.json"
        )
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise SystemExit("package.json is not valid JSON: %s" % exc)


def mutate_packages(names, action, dry_run):
    package = read_package_json()
    dependencies = package.setdefault("dependencies", {})
    if not isinstance(dependencies, dict):
        raise SystemExit("package.json dependencies must be an object")
    for name in names:
        entry = PACKAGE_PROFILES[name]
        dependency = entry["dependency"]
        if action == "apply":
            dependencies[dependency] = entry["version"]
        else:
            for section in ("dependencies", "devDependencies", "optionalDependencies"):
                value = package.get(section)
                if isinstance(value, dict):
                    value.pop(dependency, None)
                    if not value:
                        package.pop(section, None)
    if dry_run:
        print("DRY RUN package.json")
        print(json.dumps(package, indent=2))
    else:
        Path("package.json").write_text(json.dumps(package, indent=2) + "\n")
        print("  wrote package.json")


def check(args):
    profile = (args.profile or "").lower()
    if profile and profile not in KNOWN + ["all"]:
        sys.exit(
            "unknown profile: %s\nknown profiles: %s, all" % (profile, ", ".join(KNOWN))
        )
    try:
        claude = read_claude().get("mcpServers", {})
    except Exception:
        claude = {}
    codex_text = (
        Path(".codex/config.toml").read_text()
        if Path(".codex/config.toml").exists()
        else ""
    )
    codex = set(re.findall(r"^\[mcp_servers\.([^\].]+)\]", codex_text, re.M))
    package = {}
    if Path("package.json").exists():
        try:
            package = json.loads(Path("package.json").read_text())
        except Exception:
            package = {}
    package_deps = {}
    for section in ("dependencies", "devDependencies", "optionalDependencies"):
        value = package.get(section)
        if isinstance(value, dict):
            package_deps.update(value)
    expected_mcp = set(
        sorted(MCP_PROFILES)
        if profile == "all"
        else [profile]
        if profile in MCP_PROFILES
        else [n for n in MCP_PROFILES if n in claude or n in codex]
    )
    expected_packages = set(
        sorted(PACKAGE_PROFILES)
        if profile == "all"
        else [profile]
        if profile in PACKAGE_PROFILES
        else [
            n
            for n, entry in PACKAGE_PROFILES.items()
            if entry["dependency"] in package_deps
        ]
    )
    if not expected_mcp and not expected_packages:
        print(
            "PASS no optional profiles installed\n\nProfile check passed: 0 warning(s)"
        )
        return
    failures, warnings, checks = [], [], []
    for name in sorted(expected_mcp):
        missing = False
        if name not in claude:
            failures.append("Claude profile missing: " + name)
            missing = True
        if name not in codex:
            failures.append("Codex profile missing: " + name)
            missing = True
        entry = claude.get(name, {})
        if (
            name == "stripe"
            and "STRIPE_SECRET_KEY" not in entry.get("env", {})
            and "STRIPE_SECRET_KEY" not in os.environ
        ):
            (failures if args.strict_auth else warnings).append(
                "Stripe profile needs STRIPE_SECRET_KEY in environment before use"
            )
        if name == "supabase":
            query = parse_qs(urlparse(entry.get("url", "")).query)
            if query.get("read_only", [""])[0] != "true":
                failures.append("Supabase profile must be read_only=true")
            if "project_ref" not in query:
                warnings.append(
                    "Supabase profile has no project_ref; set SUPABASE_PROJECT_REF before applying when you want one project pinned"
                )
        if name in {"vercel", "figma"}:
            checks.append(
                name.capitalize()
                + " profile uses hosted OAuth MCP; run the client MCP auth flow if prompted"
            )
        if not missing:
            print("PASS profile present in Claude and Codex config: " + name)
    for name in sorted(expected_packages):
        dependency = PACKAGE_PROFILES[name]["dependency"]
        if dependency in package_deps:
            print("PASS package profile present in package.json: " + name)
        else:
            failures.append("package profile missing from package.json: " + name)
    for item in checks:
        print("CHECK " + item)
    for item in warnings:
        print("WARN " + item)
    for item in failures:
        print("FAIL " + item)
    print()
    if failures:
        print(
            "Profile check failed: %s failure(s), %s warning(s)"
            % (len(failures), len(warnings))
        )
        sys.exit(1)
    print("Profile check passed: %s warning(s)" % len(warnings))


def main():
    root = argparse.ArgumentParser()
    sub = root.add_subparsers(dest="cmd", required=True)
    for cmd in ("apply", "remove"):
        parser = sub.add_parser(cmd)
        parser.add_argument("profile")
        parser.add_argument("--tool", choices=("claude", "codex", "all"), default="all")
        parser.add_argument("--dry-run", action="store_true")
    parser = sub.add_parser("check")
    parser.add_argument("profile", nargs="?")
    parser.add_argument("--strict-auth", action="store_true")
    ns = root.parse_args()
    mutate(ns, ns.cmd) if ns.cmd in {"apply", "remove"} else check(ns)


if __name__ == "__main__":
    main()
