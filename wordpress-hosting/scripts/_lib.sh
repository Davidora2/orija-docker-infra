#!/usr/bin/env bash
# Shared helpers for Orija WordPress hosting scripts.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/.." && pwd)"
REGISTRY="$ROOT_DIR/sites/registry.yaml"
PLATFORM_COMPOSE="$ROOT_DIR/platform/docker-compose.yml"
SITE_COMPOSE_REL="wordpress-hosting/templates/wordpress-site/docker-compose.yml"
DEFAULT_PORTAINER_URL="${PORTAINER_URL:-https://portainer.orija.store}"
DEFAULT_REPO_URL="${REPO_URL:-https://github.com/Davidora2/orija-docker-infra}"
DEFAULT_ENDPOINT_ID="${PORTAINER_ENDPOINT_ID:-3}"

rand_password() {
  local len="${1:-32}"
  openssl rand -base64 48 | tr -d '/+=\n' | head -c "$len"
}

require_cmd() {
  local c
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || {
      echo "Missing required command: $c" >&2
      exit 1
    }
  done
}

load_portainer_auth() {
  export PORTAINER_URL="${PORTAINER_URL:-$DEFAULT_PORTAINER_URL}"
  export PORTAINER_API_TOKEN="${PORTAINER_API_TOKEN:-${PORTAINER_TOKEN:-}}"
  if [[ -z "${PORTAINER_API_TOKEN}" ]]; then
    echo "Missing PORTAINER_API_TOKEN (or PORTAINER_TOKEN). Add it as an environment secret." >&2
    exit 1
  fi
  AUTH_HEADER=(-H "X-API-Key: ${PORTAINER_API_TOKEN}")
}

portainer_get() {
  curl -fsS --max-time 60 "${AUTH_HEADER[@]}" "${PORTAINER_URL}$1"
}

resolve_endpoint_id() {
  local id name
  id="${PORTAINER_ENDPOINT_ID:-}"
  if [[ -n "$id" ]]; then
    echo "$id"
    return
  fi
  name="$(portainer_get /api/endpoints | python3 -c '
import json,sys
eps=json.load(sys.stdin)
for e in eps:
  if e.get("Name")=="local":
    print(e["Id"]); break
else:
  print(eps[0]["Id"] if eps else "", end="")
')"
  if [[ -z "$name" ]]; then
    echo "Could not resolve Portainer endpoint id" >&2
    exit 1
  fi
  echo "$name"
}

slug_ok() {
  [[ "$1" =~ ^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$ ]]
}

next_free_port() {
  python3 - "$REGISTRY" <<'PY'
import sys, yaml
from pathlib import Path
reg_path = Path(sys.argv[1])
data = yaml.safe_load(reg_path.read_text()) or {}
pr = data.get("port_range") or {}
start = int(pr.get("start", 19100))
end = int(pr.get("end", 19999))
used = {int(s["host_port"]) for s in data.get("sites") or [] if s.get("host_port") is not None}
for p in range(start, end + 1):
    if p not in used:
        print(p)
        sys.exit(0)
print("No free ports in configured range", file=sys.stderr)
sys.exit(1)
PY
}

registry_has_slug() {
  python3 - "$REGISTRY" "$1" <<'PY'
import sys, yaml
from pathlib import Path
data = yaml.safe_load(Path(sys.argv[1]).read_text()) or {}
slug = sys.argv[2]
sys.exit(0 if any(s.get("slug")==slug for s in data.get("sites") or []) else 1)
PY
}

upsert_registry_site() {
  python3 - "$REGISTRY" <<'PY'
import json, os, sys, yaml
from datetime import datetime, timezone
from pathlib import Path

path = Path(sys.argv[1])
data = yaml.safe_load(path.read_text()) or {}
sites = data.setdefault("sites", [])
entry = {
    "slug": os.environ["SITE_SLUG"],
    "stack": f"wp-{os.environ['SITE_SLUG']}",
    "domain": os.environ["SITE_DOMAIN"],
    "title": os.environ["SITE_TITLE"],
    "host_port": int(os.environ["HOST_PORT"]),
    "admin_user": os.environ["WP_ADMIN_USER"],
    "admin_email": os.environ["WP_ADMIN_EMAIL"],
    "created_at": os.environ.get("CREATED_AT") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "status": os.environ.get("SITE_STATUS", "provisioned"),
    "notes": os.environ.get("SITE_NOTES", ""),
}
updated = False
for i, s in enumerate(sites):
    if s.get("slug") == entry["slug"]:
        entry["created_at"] = s.get("created_at", entry["created_at"])
        sites[i] = entry
        updated = True
        break
if not updated:
    sites.append(entry)
sites.sort(key=lambda s: s.get("slug") or "")
path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
print(json.dumps(entry, indent=2))
PY
}

env_file_to_portainer_env_json() {
  # Reads KEY=VAL lines → JSON array for Portainer Env
  python3 - "$1" <<'PY'
import json, sys
from pathlib import Path
env = []
for line in Path(sys.argv[1]).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env.append({"name": k.strip(), "value": v.strip()})
print(json.dumps(env))
PY
}

find_stack_id() {
  local name="$1"
  portainer_get /api/stacks | python3 -c '
import json,sys
name=sys.argv[1]
stacks=json.load(sys.stdin)
for s in stacks:
  if s.get("Name")==name:
    print(s["Id"]); break
' "$name"
}

git_ref() {
  echo "${GIT_REF:-refs/heads/$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)}"
}

echo_ok() { printf '✓ %s\n' "$*"; }
echo_info() { printf '→ %s\n' "$*"; }
echo_warn() { printf '! %s\n' "$*" >&2; }
