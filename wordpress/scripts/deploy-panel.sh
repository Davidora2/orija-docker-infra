#!/usr/bin/env bash
# Deploy the hosting control panel stack to Portainer.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE="$ROOT/wordpress/panel/compose.yml"
PORTAINER_URL="${PORTAINER_URL:-https://portainer.orija.store}"
PORTAINER_API_TOKEN="${PORTAINER_API_TOKEN:-${PORTAINER_TOKEN:-}}"
STACK_NAME="wp-panel"

[[ -n "$PORTAINER_API_TOKEN" ]] || { echo "Missing PORTAINER_API_TOKEN" >&2; exit 1; }
[[ -n "${PANEL_PASSWORD:-}" ]] || { echo "Set PANEL_PASSWORD" >&2; exit 1; }
PANEL_SESSION_SECRET="${PANEL_SESSION_SECRET:-$(openssl rand -hex 32)}"
PANEL_GIT_REF="${PANEL_GIT_REF:-refs/heads/cursor/wordpress-portainer-hosting-4648}"
PANEL_DOMAIN="${PANEL_DOMAIN:-hosting.orija.store}"

AUTH=(-H "X-API-Key: $PORTAINER_API_TOKEN")
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/endpoints" > /tmp/pt-eps.json
EP="$(python3 - <<'PY'
import json
eps=json.load(open("/tmp/pt-eps.json"))
print(next((e["Id"] for e in eps if str(e.get("Name","")).lower()=="local"), eps[0]["Id"]))
PY
)"

python3 - <<PY
import json, os
from pathlib import Path
compose = Path(${COMPOSE@Q}).read_text()
env = [
  {"name": "PORTAINER_URL", "value": os.environ.get("PORTAINER_URL", "https://portainer.orija.store")},
  {"name": "PORTAINER_API_TOKEN", "value": os.environ["PORTAINER_API_TOKEN"]},
  {"name": "PORTAINER_ENDPOINT_ID", "value": "3"},
  {"name": "PANEL_PASSWORD", "value": os.environ["PANEL_PASSWORD"]},
  {"name": "PANEL_SESSION_SECRET", "value": os.environ["PANEL_SESSION_SECRET"]},
  {"name": "PANEL_GIT_REF", "value": os.environ.get("PANEL_GIT_REF", "refs/heads/cursor/wordpress-portainer-hosting-4648")},
  {"name": "PANEL_DOMAIN", "value": os.environ.get("PANEL_DOMAIN", "hosting.orija.store")},
  {"name": "DEFAULT_DOMAIN_SUFFIX", "value": os.environ.get("DEFAULT_DOMAIN_SUFFIX", "orija.store")},
  {"name": "PANEL_TITLE", "value": os.environ.get("PANEL_TITLE", "Orija")},
]
json.dump({"Name": "wp-panel", "StackFileContent": compose, "Env": env}, open("/tmp/wp-panel-stack.json","w"))
json.dump({"stackFileContent": compose, "env": env, "prune": False, "pullImage": True}, open("/tmp/wp-panel-update.json","w"))
print("payload ready")
PY

curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/stacks" > /tmp/pt-stacks.json
SID="$(python3 - <<'PY'
import json
for s in json.load(open("/tmp/pt-stacks.json")):
  if s.get("Name")=="wp-panel":
    print(s["Id"]); break
PY
)"

if [[ -n "$SID" ]]; then
  echo "Updating wp-panel id=$SID"
  curl -fsS --max-time 300 "${AUTH[@]}" -H "Content-Type: application/json" \
    --data-binary @/tmp/wp-panel-update.json \
    -X PUT "$PORTAINER_URL/api/stacks/${SID}?endpointId=$EP" >/tmp/wp-panel-result.json
else
  echo "Creating wp-panel"
  curl -fsS --max-time 300 "${AUTH[@]}" -H "Content-Type: application/json" \
    --data-binary @/tmp/wp-panel-stack.json \
    -X POST "$PORTAINER_URL/api/stacks/create/standalone/string?endpointId=$EP" >/tmp/wp-panel-result.json
fi
echo "✓ wp-panel deployed"
echo "Tunnel: ${PANEL_DOMAIN} → http://localhost:18100"
echo "Open:   https://${PANEL_DOMAIN}"
