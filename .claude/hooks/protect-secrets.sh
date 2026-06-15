#!/usr/bin/env bash
# Blocks Read/Write/Edit on sensitive files. Exit 2 = hard block.
INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    ti = json.load(sys.stdin).get('tool_input', {})
    print(ti.get('file_path', '') or ti.get('path', ''))
except Exception:
    pass
" 2>/dev/null)

[ -z "$FILE" ] && exit 0

# Non-secret templates/examples hold no secrets — allow the file tools to read/edit them.
case "$FILE" in
  *.example) exit 0 ;;
esac

PATTERNS=(
  '\.env$' '\.env\.' '\.pem$' '\.key$' '\.p12$' '\.pfx$'
  'id_rsa' 'id_ed25519' 'id_ecdsa'
  'credentials\.json$' '\.netrc$' 'secrets\.'
)

for pat in "${PATTERNS[@]}"; do
  if printf '%s' "$FILE" | grep -qE "$pat"; then
    echo "BLOCKED: sensitive file — $FILE" >&2
    exit 2
  fi
done
exit 0
