#!/usr/bin/env bash
# Provision a new isolated WordPress site stack under wordpress/sites/<slug>/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WP_ROOT="$ROOT/wordpress"
TEMPLATE="$WP_ROOT/templates/site"
REGISTRY="$WP_ROOT/sites/registry.yaml"

usage() {
  cat <<'EOF'
Usage: new-site.sh --slug SLUG --domain DOMAIN --owner ACCOUNT [--title TITLE]

Creates an isolated WordPress site stack (own DB + volumes + Traefik route).

Required:
  --slug     Short id (lowercase, a-z0-9-, max 32). Example: acme
  --domain   Public hostname. Example: acme.orija.store
  --owner    Account id from registry (or new id). Example: alice

Optional:
  --title    WordPress site title (default: slug)
  --force    Overwrite existing site directory (dangerous)

Examples:
  ./wordpress/scripts/new-site.sh --slug acme --domain acme.orija.store --owner alice --title "Acme Co"
EOF
}

SLUG=""
DOMAIN=""
OWNER=""
TITLE=""
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="${2:-}"; shift 2 ;;
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --owner) OWNER="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$SLUG" || -z "$DOMAIN" || -z "$OWNER" ]]; then
  usage
  exit 1
fi

if ! [[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$ ]]; then
  echo "Invalid slug '$SLUG'. Use lowercase letters, digits, hyphens (max 32)." >&2
  exit 1
fi

TITLE="${TITLE:-$SLUG}"
SITE_DIR="$WP_ROOT/sites/$SLUG"
STACK_NAME="wp-$SLUG"

if [[ -d "$SITE_DIR" && "$FORCE" -ne 1 ]]; then
  echo "Site directory already exists: $SITE_DIR (use --force to overwrite)" >&2
  exit 1
fi

mkdir -p "$SITE_DIR"

gen_password() {
  openssl rand -base64 36 | tr -d '/+=\n' | head -c 32
}

MYSQL_PASSWORD="$(gen_password)"
MYSQL_ROOT_PASSWORD="$(gen_password)"
CREATED="$(date -u +%Y-%m-%d)"

# Render compose with placeholders replaced
sed \
  -e "s/__SITE_SLUG__/${SLUG}/g" \
  -e "s/__SITE_DOMAIN__/${DOMAIN}/g" \
  -e "s/__OWNER_ACCOUNT__/${OWNER}/g" \
  "$TEMPLATE/compose.yml" > "$SITE_DIR/compose.yml"

# Render .env with secrets
sed \
  -e "s/__MYSQL_PASSWORD__/${MYSQL_PASSWORD}/g" \
  -e "s/__MYSQL_ROOT_PASSWORD__/${MYSQL_ROOT_PASSWORD}/g" \
  "$TEMPLATE/.env.example" > "$SITE_DIR/.env"

# Site metadata (safe to commit if .env is gitignored)
cat > "$SITE_DIR/site.yaml" <<EOF
slug: ${SLUG}
domain: ${DOMAIN}
title: ${TITLE}
owner_account: ${OWNER}
stack_name: ${STACK_NAME}
status: provisioned
created: ${CREATED}
compose: compose.yml
notes: |
  1. Deploy wp-platform first (shared Traefik + redis).
  2. Deploy this stack in Portainer (name: ${STACK_NAME}).
  3. Point Cloudflare Tunnel hostname ${DOMAIN} → http://localhost:18100
  4. Open https://${DOMAIN}/wp-admin/install.php and create the WP admin user.
EOF

# Credentials helper file (gitignored via sites/*/.env pattern — also write secrets.txt locally only)
cat > "$SITE_DIR/CREDENTIALS.txt" <<EOF
# KEEP PRIVATE — do not commit
Site:     ${TITLE}
Slug:     ${SLUG}
Domain:   https://${DOMAIN}
Stack:    ${STACK_NAME}
Owner:    ${OWNER}

MySQL user:     wp_user
MySQL password: ${MYSQL_PASSWORD}
MySQL root:     ${MYSQL_ROOT_PASSWORD}
Database:       wordpress

WordPress admin: create on first visit to
  https://${DOMAIN}/wp-admin/install.php
EOF

chmod 600 "$SITE_DIR/.env" "$SITE_DIR/CREDENTIALS.txt" 2>/dev/null || true

python3 "$ROOT/wordpress/scripts/registry_lib.py" upsert-site \
  --registry "$REGISTRY" \
  --slug "$SLUG" \
  --domain "$DOMAIN" \
  --title "$TITLE" \
  --owner "$OWNER" \
  --stack-name "$STACK_NAME" \
  --created "$CREATED"

cat <<EOF

✓ Site provisioned: ${SITE_DIR}

Next steps:
  1. Ensure platform is running:
       Portainer → stacks → wp-platform (wordpress/platform/compose.yml)
  2. Deploy site stack "${STACK_NAME}" from:
       ${SITE_DIR}/compose.yml
     with env file:
       ${SITE_DIR}/.env
  3. Cloudflare Tunnel: ${DOMAIN} → http://localhost:18100
  4. Install WordPress admin at https://${DOMAIN}/wp-admin/install.php
  5. Credentials saved in ${SITE_DIR}/CREDENTIALS.txt (do not commit)

Optional API deploy:
  ./wordpress/scripts/deploy-site.sh --slug ${SLUG}
EOF
