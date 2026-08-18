#!/usr/bin/env bash
# Deploy a site stack to Portainer from the generated compose string (not git),
# so per-site secrets in .env never need to live in the repository.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WP_ROOT="$ROOT/wordpress"

PORTAINER_URL="${PORTAINER_URL:-https://portainer.orija.store}"
PORTAINER_API_TOKEN="${PORTAINER_API_TOKEN:-${PORTAINER_TOKEN:-}}"

usage() {
  cat <<'EOF'
Usage: deploy-site.sh --slug SLUG

Deploys wordpress/sites/<slug>/compose.yml to Portainer as stack wp-<slug>
using the string (inline compose) API and env vars from the site .env file.

Requires:
  PORTAINER_API_TOKEN
  Site provisioned via new-site.sh
  wp-platform stack already running (creates network wp-public)
EOF
}

SLUG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$SLUG" ]]; then usage; exit 1; fi
if [[ -z "$PORTAINER_API_TOKEN" ]]; then
  echo "Missing PORTAINER_API_TOKEN" >&2
  exit 1
fi

SITE_DIR="$WP_ROOT/sites/$SLUG"
COMPOSE="$SITE_DIR/compose.yml"
ENV_FILE="$SITE_DIR/.env"
STACK_NAME="wp-$SLUG"

[[ -f "$COMPOSE" ]] || { echo "Missing $COMPOSE — run new-site.sh first" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

AUTH=(-H "X-API-Key: $PORTAINER_API_TOKEN")
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/endpoints" > /tmp/portainer-endpoints.json
EP="$(python3 - <<'PY'
import json
eps = json.load(open("/tmp/portainer-endpoints.json"))
for e in eps:
    if str(e.get("Name","")).lower() == "local":
        print(e["Id"]); break
else:
    print(eps[0]["Id"] if eps else "")
PY
)"
[[ -n "$EP" ]] || { echo "No endpoint"; exit 1; }

# Build env array from .env
python3 - <<PY
import json
from pathlib import Path

compose = Path(${COMPOSE@Q}).read_text()
env_vars = []
for line in Path(${ENV_FILE@Q}).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env_vars.append({"name": k, "value": v})

payload = {
    "Name": ${STACK_NAME@Q},
    "StackFileContent": compose,
    "Env": env_vars,
}
json.dump(payload, open("/tmp/wp-site-stack.json", "w"))
print(f"Prepared stack {payload['Name']} with {len(env_vars)} env vars")
PY

curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/stacks" > /tmp/portainer-stacks.json
STACK_ID="$(STACK_NAME="$STACK_NAME" python3 - <<'PY'
import json, os
name = os.environ["STACK_NAME"]
for s in json.load(open("/tmp/portainer-stacks.json")):
    if s.get("Name") == name:
        print(s["Id"]); break
PY
)"

if [[ -n "$STACK_ID" ]]; then
  echo "Updating existing stack id=$STACK_ID ..."
  # Portainer update for string stacks: PUT /api/stacks/{id}?endpointId=
  python3 - <<PY
import json
base = json.load(open("/tmp/wp-site-stack.json"))
body = {
  "stackFileContent": base["StackFileContent"],
  "env": base["Env"],
  "prune": False,
  "pullImage": True,
}
json.dump(body, open("/tmp/wp-site-update.json", "w"))
PY
  curl -fsS --max-time 180 "${AUTH[@]}" -H "Content-Type: application/json" \
    --data-binary @/tmp/wp-site-update.json \
    -X PUT "$PORTAINER_URL/api/stacks/${STACK_ID}?endpointId=$EP"
  echo
  echo "✓ Updated $STACK_NAME"
else
  echo "Creating stack $STACK_NAME ..."
  curl -fsS --max-time 180 "${AUTH[@]}" -H "Content-Type: application/json" \
    --data-binary @/tmp/wp-site-stack.json \
    -X POST "$PORTAINER_URL/api/stacks/create/standalone/string?endpointId=$EP"
  echo
  echo "✓ Created $STACK_NAME"
fi

DOMAIN="$(grep -E '^domain:' "$SITE_DIR/site.yaml" | awk '{print $2}')"
echo
echo "Next: map Cloudflare Tunnel $DOMAIN → http://localhost:18100"
echo "Then open https://$DOMAIN/wp-admin/install.php"
