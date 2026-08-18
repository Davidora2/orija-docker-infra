#!/usr/bin/env bash
# Remove a site from the registry and optionally tear down its Portainer stack.
# Does NOT delete Docker volumes by default (data safety).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

python3 -c 'import yaml' 2>/dev/null || pip3 install --user pyyaml >/dev/null

SLUG="${1:-}"
DELETE_STACK=0
[[ -n "$SLUG" ]] || {
  echo "Usage: $0 <slug> [--delete-stack]" >&2
  exit 1
}
shift || true
[[ "${1:-}" == "--delete-stack" ]] && DELETE_STACK=1

python3 - "$REGISTRY" "$SLUG" <<'PY'
import sys, yaml
from pathlib import Path
path = Path(sys.argv[1])
slug = sys.argv[2]
data = yaml.safe_load(path.read_text()) or {}
before = len(data.get("sites") or [])
data["sites"] = [s for s in data.get("sites") or [] if s.get("slug") != slug]
path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
print(f"Removed registry entries: {before - len(data['sites'])}")
PY

if [[ "$DELETE_STACK" -eq 1 ]]; then
  load_portainer_auth
  EP="$(resolve_endpoint_id)"
  STACK_NAME="wp-$SLUG"
  SID="$(find_stack_id "$STACK_NAME" || true)"
  if [[ -n "$SID" ]]; then
    echo_info "Deleting Portainer stack $STACK_NAME (id=$SID) — volumes retained on host"
    curl -fsS --max-time 120 "${AUTH_HEADER[@]}" \
      -X DELETE "$PORTAINER_URL/api/stacks/${SID}?endpointId=${EP}&external=false" >/dev/null
    echo_ok "Stack deleted"
  else
    echo_warn "Stack $STACK_NAME not found in Portainer"
  fi
fi

echo_info "Local secrets left at sites/$SLUG/ (delete manually if desired)"
echo_ok "Done"
