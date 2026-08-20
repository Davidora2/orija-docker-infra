#!/usr/bin/env bash
# Remove a provisioned site directory from the repo inventory.
# Does NOT delete running Portainer stacks or Docker volumes — that is intentional.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WP_ROOT="$ROOT/wordpress"
REGISTRY="$WP_ROOT/sites/registry.yaml"

usage() {
  cat <<'EOF'
Usage: remove-site.sh --slug SLUG [--yes]

Removes wordpress/sites/<slug>/ from the repo and drops the registry entry.
Does NOT stop/delete the Portainer stack or Docker volumes.

To fully tear down a live site:
  1. Portainer → Stacks → wp-<slug> → Delete (optionally remove volumes)
  2. Remove Cloudflare Tunnel hostname for the domain
  3. Run this script to clean the repo inventory
EOF
}

SLUG=""
YES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="${2:-}"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$SLUG" ]]; then
  usage
  exit 1
fi

SITE_DIR="$WP_ROOT/sites/$SLUG"
if [[ ! -d "$SITE_DIR" ]]; then
  echo "No site directory: $SITE_DIR" >&2
  exit 1
fi

if [[ "$YES" -ne 1 ]]; then
  echo "Will remove: $SITE_DIR"
  echo "Registry entry for slug=$SLUG will be removed."
  echo "Running Portainer stack wp-$SLUG will NOT be deleted."
  read -r -p "Continue? [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || exit 1
fi

rm -rf "$SITE_DIR"

python3 "$ROOT/wordpress/scripts/registry_lib.py" remove-site \
  --registry "$REGISTRY" \
  --slug "$SLUG"

echo "✓ Removed local site files for $SLUG"
echo "Remember to delete Portainer stack wp-$SLUG and tunnel hostname if still live."
