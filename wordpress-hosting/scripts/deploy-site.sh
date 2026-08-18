#!/usr/bin/env bash
# Deploy (create or git-redeploy) a WordPress site stack in Portainer.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

require_cmd curl python3
python3 -c 'import yaml' 2>/dev/null || pip3 install --user pyyaml >/dev/null

usage() {
  echo "Usage: $0 <slug> [--local]"
  echo "  Deploys sites/<slug>/.env as Portainer stack wp-<slug>"
  echo "  --local  uses docker compose on this machine instead of Portainer"
}

SLUG="${1:-}"
MODE="portainer"
[[ -n "$SLUG" ]] || { usage; exit 1; }
shift || true
if [[ "${1:-}" == "--local" ]]; then
  MODE="local"
fi

slug_ok "$SLUG" || { echo "Invalid slug: $SLUG" >&2; exit 1; }
ENV_FILE="$ROOT_DIR/sites/$SLUG/.env"
[[ -f "$ENV_FILE" ]] || {
  echo "Missing $ENV_FILE — run provision-site.sh first" >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

STACK_NAME="wp-$SLUG"
COMPOSE_FILE="$ROOT_DIR/templates/wordpress-site/docker-compose.yml"

case "$MODE" in
  local)
    require_cmd docker
    echo_info "Ensuring platform network exists"
    docker network inspect wp-platform >/dev/null 2>&1 || \
      docker compose -f "$PLATFORM_COMPOSE" --project-name wp-platform up -d
    echo_info "Starting $STACK_NAME locally on port $HOST_PORT"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --project-name "$STACK_NAME" up -d
    echo_ok "Local stack up: http://127.0.0.1:${HOST_PORT}"
    ;;
  portainer)
    load_portainer_auth
    EP="$(resolve_endpoint_id)"
    REF="$(git_ref)"
    env_file_to_portainer_env_json "$ENV_FILE" >/tmp/wp-site-env.json
    EXISTING="$(find_stack_id "$STACK_NAME" || true)"

    python3 - <<PY
import json, os
env = json.load(open("/tmp/wp-site-env.json"))
payload = {
  "Name": "$STACK_NAME",
  "RepositoryURL": os.environ.get("REPO_URL", "$DEFAULT_REPO_URL"),
  "RepositoryReferenceName": "$REF",
  "ComposeFile": "$SITE_COMPOSE_REL",
  "RepositoryAuthentication": False,
  "Env": env,
}
open("/tmp/wp-site-stack.json", "w").write(json.dumps(payload))
open("/tmp/wp-site-redeploy.json", "w").write(json.dumps({
  "PullImage": True,
  "RepositoryAuthentication": False,
  "RepositoryReferenceName": "$REF",
  "Env": env,
}))
print("Stack payload ready (%d env vars)" % len(env))
PY

    if [[ -n "$EXISTING" ]]; then
      echo_info "Redeploying $STACK_NAME (id=$EXISTING) from $REF"
      curl -fsS --max-time 300 "${AUTH_HEADER[@]}" -H "Content-Type: application/json" \
        --data-binary @/tmp/wp-site-redeploy.json \
        -X PUT "$PORTAINER_URL/api/stacks/${EXISTING}/git/redeploy?endpointId=${EP}" \
        >/tmp/wp-site-result.json
    else
      echo_info "Creating $STACK_NAME from git ($REF)"
      curl -fsS --max-time 300 "${AUTH_HEADER[@]}" -H "Content-Type: application/json" \
        --data-binary @/tmp/wp-site-stack.json \
        -X POST "$PORTAINER_URL/api/stacks/create/standalone/repository?endpointId=${EP}" \
        >/tmp/wp-site-result.json
    fi

    export SITE_SLUG="$SLUG" SITE_DOMAIN="$SITE_DOMAIN" SITE_TITLE="$SITE_TITLE" \
      HOST_PORT="$HOST_PORT" WP_ADMIN_USER="$WP_ADMIN_USER" WP_ADMIN_EMAIL="$WP_ADMIN_EMAIL" \
      SITE_STATUS="deployed" SITE_NOTES="${SITE_NOTES:-}"
    upsert_registry_site >/dev/null

    echo_ok "Deployed $STACK_NAME"
    echo_info "Public URL (after tunnel): https://$SITE_DOMAIN"
    echo_info "Origin: http://localhost:$HOST_PORT"
    echo_info "Admin:  https://$SITE_DOMAIN/wp-admin  (user: $WP_ADMIN_USER)"
    ;;
esac
