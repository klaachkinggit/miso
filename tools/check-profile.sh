#!/usr/bin/env bash
set -euo pipefail
exec python3 tools/profile.py check "$@"
