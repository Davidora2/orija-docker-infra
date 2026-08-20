#!/usr/bin/env bash
# List provisioned WordPress sites from the registry and site directories.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGISTRY="$ROOT/wordpress/sites/registry.yaml"
SITES_DIR="$ROOT/wordpress/sites"

echo "=== WordPress hosting inventory ==="
echo

if [[ -f "$REGISTRY" ]]; then
  echo "-- registry.yaml --"
  REGISTRY="$REGISTRY" python3 - <<'PY'
from pathlib import Path
import os
text = Path(os.environ["REGISTRY"]).read_text()
print("Platform:")
for line in text.splitlines():
    if line.startswith("  stack_name:") or line.startswith("  http_port:") or line.startswith("  tunnel_origin:") or line.startswith("  network:"):
        print(" ", line.strip())

print("\nAccounts:")
in_accounts = False
in_sites = False
for line in text.splitlines():
    if line.startswith("accounts:"):
        in_accounts, in_sites = True, False
        if "[]" in line:
            print("  (none)")
        continue
    if line.startswith("sites:"):
        in_accounts, in_sites = False, True
        print("\nSites:")
        if "[]" in line:
            print("  (none)")
        continue
    if in_accounts and line.startswith("  -"):
        print(line)
    elif in_accounts and line.startswith("    "):
        print(line)
    elif in_sites and line.startswith("  -"):
        print(line)
    elif in_sites and line.startswith("    "):
        print(line)
PY
else
  echo "No registry found at $REGISTRY"
fi

echo
echo "-- site directories --"
found=0
for d in "$SITES_DIR"/*/; do
  [[ -d "$d" ]] || continue
  base="$(basename "$d")"
  [[ "$base" == .* ]] && continue
  if [[ -f "$d/site.yaml" ]]; then
    found=1
    echo "• $base"
    grep -E '^(slug|domain|owner_account|stack_name|status):' "$d/site.yaml" | sed 's/^/    /'
  fi
done
if [[ "$found" -eq 0 ]]; then
  echo "(no site directories yet — run new-site.sh)"
fi
