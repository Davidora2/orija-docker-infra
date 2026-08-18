#!/usr/bin/env bash
# List WordPress sites from the registry (and optionally Portainer).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

python3 -c 'import yaml' 2>/dev/null || pip3 install --user pyyaml >/dev/null

WITH_PORTAINER=0
[[ "${1:-}" == "--portainer" ]] && WITH_PORTAINER=1

python3 - "$REGISTRY" <<'PY'
import sys, yaml
from pathlib import Path
data = yaml.safe_load(Path(sys.argv[1]).read_text()) or {}
sites = data.get("sites") or []
print(f"Host: {data.get('host')}  |  Portainer: {data.get('portainer_url')}")
print(f"Platform stack: {data.get('platform_stack')}  |  Sites: {len(sites)}")
print("-" * 88)
fmt = "{:<14} {:<28} {:>6} {:<16} {:<10} {}"
print(fmt.format("SLUG", "DOMAIN", "PORT", "ADMIN", "STATUS", "STACK"))
print("-" * 88)
for s in sites:
    print(fmt.format(
        s.get("slug",""),
        s.get("domain",""),
        s.get("host_port",""),
        s.get("admin_user",""),
        s.get("status",""),
        s.get("stack",""),
    ))
if not sites:
    print("(no sites yet — run scripts/provision-site.sh)")
PY

if [[ "$WITH_PORTAINER" -eq 1 ]]; then
  load_portainer_auth
  echo
  echo_info "Portainer stacks matching wp-*"
  portainer_get /api/stacks | python3 <<'PY'
import json, sys
for s in json.load(sys.stdin):
    name = s.get("Name") or ""
    if name == "wp-platform" or name.startswith("wp-"):
        git = ((s.get("GitConfig") or {}).get("URL") or "-")
        print(f"  {name:20} id={s.get('Id')} status={s.get('Status')} git={git}")
PY
fi
