#!/usr/bin/env bash
# Blocks known-dangerous shell patterns. Exit 2 = hard block.
# bash 3.2 compatible (no associative arrays — macOS ships bash 3.2).
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('tool_input', {}).get('command', ''))
except Exception:
    pass
" 2>/dev/null)

[ -z "$CMD" ] && exit 0

# Parallel arrays — index i pairs DESCS[i] with REGEXES[i].
# Catastrophic rm = RECURSIVE (-r/-R) on a critical target. Non-recursive rm of a
# specific file (even by absolute path) is NOT blocked — that's a normal operation.
# EXCEPTION: secret env files (.env / .env.local) ARE protected from rm/mv/truncate
# via Bash, since protect-secrets.sh only covers the Edit/Write/Read tools, not Bash.
# Append (>>) and cp (restore-from-backup) are intentionally still allowed, and
# .env.example (a non-secret, git-tracked template) is never blocked.
DESCS=(
  "recursive rm of root"
  "recursive rm of home"
  "recursive rm of current/parent dir"
  "recursive rm with bare glob"
  "sudo rm"
  "fork bomb"
  "chmod 777"
  "dd to disk device"
  "redirect to disk device"
  "mkfs"
  "pipe remote content to shell"
  "force push to main/master"
  "delete/move of .env secret file"
  "truncating redirect onto .env secret file"
  "git clean -f (removes untracked files incl .env)"
)
REGEXES=(
  'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+/([[:space:]]|$|\*)'
  'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+(~|\$HOME)([[:space:]]|/|$)'
  'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+\.\.?/?([[:space:]]|$)'
  'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+\*([[:space:]]|$)'
  'sudo[[:space:]]+rm'
  ':\(\)[[:space:]]*\{'
  'chmod[[:space:]]+[0-9]*777'
  'dd[[:space:]]+if=.*of=/dev/'
  '>[[:space:]]*/dev/s[dh][a-z]'
  'mkfs\.'
  '(curl|wget)[[:space:]].*[|][[:space:]]*(ba)?sh([[:space:]]|$)'
  'git[[:space:]]+push[[:space:]].*--force[^-]*(main|master)'
  '(rm|mv|shred|truncate)[[:space:]]+([^|;&]*[[:space:]])?\.env(\.local|\*)?([[:space:]]|"|'"'"'|$)'
  '[^>]>[[:space:]]*\.env(\.local)?([[:space:]]|"|'"'"'|$)'
  'git[[:space:]]+clean[[:space:]].*-[a-zA-Z]*f'
)

i=0
while [ $i -lt ${#REGEXES[@]} ]; do
  if printf '%s' "$CMD" | grep -qE "${REGEXES[$i]}"; then
    echo "BLOCKED: ${DESCS[$i]}" >&2
    exit 2
  fi
  i=$((i + 1))
done
exit 0
