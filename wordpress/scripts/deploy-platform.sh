#!/usr/bin/env bash
# Deploy wp-platform stack to Portainer via API (git repository method).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PORTAINER_URL="${PORTAINER_URL:-https://portainer.orija.store}"
PORTAINER_API_TOKEN="${PORTAINER_API_TOKEN:-${PORTAINER_TOKEN:-}}"
STACK_NAME="${STACK_NAME:-wp-platform}"
BRANCH="${BRANCH:-}"
COMPOSE_FILE="${COMPOSE_FILE:-wordpress/platform/compose.yml}"
PLATFORM_HTTP_PORT="${PLATFORM_HTTP_PORT:-18100}"
PLATFORM_DASHBOARD_PORT="${PLATFORM_DASHBOARD_PORT:-18101}"
REPO_URL="${REPO_URL:-https://github.com/Davidora2/orija-docker-infra}"

if [[ -z "$PORTAINER_API_TOKEN" ]]; then
  echo "Missing PORTAINER_API_TOKEN (or PORTAINER_TOKEN) secret." >&2
  echo "Add it in Cursor Environment secrets, then re-run." >&2
  exit 1
fi

AUTH=(-H "X-API-Key: $PORTAINER_API_TOKEN")

echo "Checking Portainer at $PORTAINER_URL ..."
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/status" >/tmp/portainer-status.json
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/endpoints" > /tmp/portainer-endpoints.json

EP="$(python3 - <<'PY'
import json
eps = json.load(open("/tmp/portainer-endpoints.json"))
for e in eps:
    if str(e.get("Name", "")).lower() == "local":
        print(e["Id"])
        break
else:
    print(eps[0]["Id"] if eps else "")
PY
)"

if [[ -z "$EP" ]]; then
  echo "No Portainer endpoints found." >&2
  exit 1
fi
echo "Using endpoint id=$EP"

if [[ -z "$BRANCH" ]]; then
  BRANCH="refs/heads/$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
fi

export STACK_NAME BRANCH COMPOSE_FILE PLATFORM_HTTP_PORT PLATFORM_DASHBOARD_PORT REPO_URL

python3 - <<'PY'
import json, os
payload = {
  "Name": os.environ["STACK_NAME"],
  "RepositoryURL": os.environ["REPO_URL"],
  "RepositoryReferenceName": os.environ["BRANCH"],
  "ComposeFile": os.environ["COMPOSE_FILE"],
  "RepositoryAuthentication": False,
  "Env": [
    {"name": "PLATFORM_HTTP_PORT", "value": os.environ["PLATFORM_HTTP_PORT"]},
    {"name": "PLATFORM_DASHBOARD_PORT", "value": os.environ["PLATFORM_DASHBOARD_PORT"]},
    {"name": "TRAEFIK_LOG_LEVEL", "value": "INFO"},
    {"name": "TRAEFIK_ACCESS_LOG", "value": "true"},
  ],
}
json.dump(payload, open("/tmp/wp-platform-stack.json", "w"))
print(json.dumps(payload, indent=2))
PY

curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/stacks" > /tmp/portainer-stacks.json
STACK_ID="$(STACK_NAME="$STACK_NAME" python3 - <<'PY'
import json, os
name = os.environ["STACK_NAME"]
for s in json.load(open("/tmp/portainer-stacks.json")):
    if s.get("Name") == name:
        print(s["Id"])
        break
PY
)"

if [[ -n "$STACK_ID" ]]; then
  echo "Stack $STACK_NAME exists (id=$STACK_ID) — git redeploy..."
  BRANCH="$BRANCH" python3 - <<'PY'
import json, os
env = json.load(open("/tmp/wp-platform-stack.json"))["Env"]
body = {
  "PullImage": True,
  "RepositoryAuthentication": False,
  "RepositoryReferenceName": os.environ["BRANCH"],
  "Env": env,
}
json.dump(body, open("/tmp/wp-platform-redeploy.json", "w"))
PY
  curl -fsS --max-time 180 "${AUTH[@]}" -H "Content-Type: application/json" \
    --data-binary @/tmp/wp-platform-redeploy.json \
    -X PUT "$PORTAINER_URL/api/stacks/${STACK_ID}/git/redeploy?endpointId=$EP"
  echo
  echo "✓ Redeployed $STACK_NAME"
else
  echo "Creating stack $STACK_NAME from $REPO_URL ($BRANCH) ..."
  curl -fsS --max-time 180 "${AUTH[@]}" -H "Content-Type: application/json" \
    --data-binary @/tmp/wp-platform-stack.json \
    -X POST "$PORTAINER_URL/api/stacks/create/standalone/repository?endpointId=$EP"
  echo
  echo "✓ Created $STACK_NAME"
fi

echo
echo "Tunnel origin should be: http://localhost:${PLATFORM_HTTP_PORT}"
echo "Dashboard (private):     http://<docker-host>:${PLATFORM_DASHBOARD_PORT}"
