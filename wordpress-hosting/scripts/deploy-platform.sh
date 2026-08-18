#!/usr/bin/env bash
# Deploy the shared wp-platform stack (Redis + wp-platform network).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

require_cmd curl python3

MODE="${1:-portainer}" # portainer | local

case "$MODE" in
  local)
    require_cmd docker
    echo_info "Deploying platform locally with docker compose"
    docker compose -f "$PLATFORM_COMPOSE" --project-name wp-platform up -d
    echo_ok "Platform running (network: wp-platform, redis: wp-platform-redis)"
    ;;
  portainer)
    load_portainer_auth
    EP="$(resolve_endpoint_id)"
    STACK_NAME="wp-platform"
    REF="$(git_ref)"
    EXISTING="$(find_stack_id "$STACK_NAME" || true)"

    python3 - <<PY
import json, os
payload = {
  "Name": "wp-platform",
  "RepositoryURL": os.environ.get("REPO_URL", "$DEFAULT_REPO_URL"),
  "RepositoryReferenceName": "$REF",
  "ComposeFile": "wordpress-hosting/platform/docker-compose.yml",
  "RepositoryAuthentication": False,
  "Env": [
    {"name": "REDIS_MAXMEMORY", "value": os.environ.get("REDIS_MAXMEMORY", "512mb")},
  ],
}
open("/tmp/wp-platform-stack.json", "w").write(json.dumps(payload))
print("Wrote /tmp/wp-platform-stack.json")
PY

    if [[ -n "$EXISTING" ]]; then
      echo_info "Redeploying existing stack $STACK_NAME (id=$EXISTING)"
      python3 - <<PY
import json
body = {
  "PullImage": True,
  "RepositoryAuthentication": False,
  "RepositoryReferenceName": "$REF",
  "Env": [{"name": "REDIS_MAXMEMORY", "value": "${REDIS_MAXMEMORY:-512mb}"}],
}
open("/tmp/wp-platform-redeploy.json", "w").write(json.dumps(body))
PY
      curl -fsS --max-time 180 "${AUTH_HEADER[@]}" -H "Content-Type: application/json" \
        --data-binary @/tmp/wp-platform-redeploy.json \
        -X PUT "$PORTAINER_URL/api/stacks/${EXISTING}/git/redeploy?endpointId=${EP}" >/tmp/wp-platform-result.json
    else
      echo_info "Creating stack $STACK_NAME from git ($REF)"
      curl -fsS --max-time 180 "${AUTH_HEADER[@]}" -H "Content-Type: application/json" \
        --data-binary @/tmp/wp-platform-stack.json \
        -X POST "$PORTAINER_URL/api/stacks/create/standalone/repository?endpointId=${EP}" >/tmp/wp-platform-result.json
    fi
    echo_ok "Platform stack deployed"
    python3 -c 'import json; print(json.dumps(json.load(open("/tmp/wp-platform-result.json")), indent=2)[:800])'
    ;;
  *)
    echo "Usage: $0 [portainer|local]" >&2
    exit 1
    ;;
esac
