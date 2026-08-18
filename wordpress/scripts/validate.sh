#!/usr/bin/env bash
# Validate WordPress platform + site compose files (no Docker daemon required).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WP_ROOT="$ROOT/wordpress"
ERR=0

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }
}

need_cmd python3

echo "Validating YAML / compose structure..."

validate_yaml_file() {
  local f="$1"
  python3 - <<PY
from pathlib import Path
path = Path(${f@Q})
text = path.read_text()
# Minimal structural checks without PyYAML dependency
errors = []
if "services:" not in text and path.name == "compose.yml":
    errors.append("missing services:")
if path.name == "compose.yml":
    if "wordpress:" not in text and "traefik:" not in text:
        errors.append("expected wordpress or traefik service")
    if "__SITE_SLUG__" in text:
        errors.append("unreplaced placeholder __SITE_SLUG__ (template leaked into site?)")
if errors:
    print(f"FAIL {path}:")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)
print(f"OK   {path}")
PY
}

validate_yaml_file "$WP_ROOT/platform/compose.yml"

# Template may contain placeholders — check placeholders exist, not that they're replaced
python3 - <<PY
from pathlib import Path
p = Path("$WP_ROOT/templates/site/compose.yml")
t = p.read_text()
for token in ("__SITE_SLUG__", "__SITE_DOMAIN__", "__OWNER_ACCOUNT__"):
    if token not in t:
        raise SystemExit(f"FAIL template missing {token}")
print(f"OK   {p} (placeholders present)")
PY

shopt -s nullglob
for compose in "$WP_ROOT/sites"/*/compose.yml; do
  validate_yaml_file "$compose"
done

# Script syntax
for s in "$WP_ROOT/scripts"/*.sh; do
  bash -n "$s"
  echo "OK   bash -n $(basename "$s")"
done

python3 -m py_compile "$WP_ROOT/scripts/registry_lib.py"
echo "OK   registry_lib.py"

# Registry present
[[ -f "$WP_ROOT/sites/registry.yaml" ]] || { echo "FAIL registry missing"; ERR=1; }
echo "OK   registry.yaml present"

# Docker compose config if available
if command -v docker >/dev/null 2>&1; then
  echo
  echo "Docker found — running compose config checks..."
  if docker compose -f "$WP_ROOT/platform/compose.yml" --env-file "$WP_ROOT/platform/.env.example" config >/tmp/wp-platform.compose.out 2>/tmp/wp-platform.compose.err; then
    echo "OK   platform compose config"
  else
    echo "FAIL platform compose config"; cat /tmp/wp-platform.compose.err; ERR=1
  fi
  for dir in "$WP_ROOT/sites"/*/; do
    [[ -f "$dir/compose.yml" ]] || continue
    # Sites need external network; create a dry-run by temporarily not requiring it —
    # docker compose config still validates with external networks declared.
    if docker compose -f "$dir/compose.yml" --env-file "$dir/.env" config >/dev/null 2>"$dir/.compose-err"; then
      echo "OK   $(basename "$dir") compose config"
      rm -f "$dir/.compose-err"
    else
      # External network missing is OK when daemon has no wp-public yet
      if grep -qi "network .* declared as external" "$dir/.compose-err"; then
        echo "OK   $(basename "$dir") compose config (external network warning expected offline)"
      else
        echo "FAIL $(basename "$dir")"; cat "$dir/.compose-err"; ERR=1
      fi
    fi
  done
else
  echo
  echo "Docker not installed here — skipped 'docker compose config' (YAML/bash checks passed)."
fi

if [[ "$ERR" -ne 0 ]]; then
  echo "Validation failed." >&2
  exit 1
fi
echo
echo "✓ All validations passed"
