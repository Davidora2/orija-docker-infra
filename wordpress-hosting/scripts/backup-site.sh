#!/usr/bin/env bash
# Backup a WordPress site's database + wp files from a local docker compose project.
# For Portainer hosts, run this on odserver2 (or adapt to docker exec by labels).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

require_cmd docker

SLUG="${1:-}"
OUT_DIR="${2:-$ROOT_DIR/sites/$SLUG/backups}"
[[ -n "$SLUG" ]] || {
  echo "Usage: $0 <slug> [output-dir]" >&2
  exit 1
}

ENV_FILE="$ROOT_DIR/sites/$SLUG/.env"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

STACK_NAME="wp-$SLUG"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$OUT_DIR/$STAMP"
mkdir -p "$DEST"
umask 077

DB_CTR="$(docker ps --filter "label=com.docker.compose.project=$STACK_NAME" --filter "label=com.docker.compose.service=db" -q | head -n1)"
WP_CTR="$(docker ps --filter "label=com.docker.compose.project=$STACK_NAME" --filter "label=com.docker.compose.service=wordpress" -q | head -n1)"

if [[ -z "$DB_CTR" || -z "$WP_CTR" ]]; then
  # Fallback: Portainer may not set compose project labels the same way — try name patterns
  DB_CTR="$(docker ps --format '{{.ID}} {{.Names}}' | awk -v s="$SLUG" '$0 ~ s && $0 ~ /db/ {print $1; exit}')"
  WP_CTR="$(docker ps --format '{{.ID}} {{.Names}}' | awk -v s="$SLUG" '$0 ~ s && $0 ~ /wordpress/ {print $1; exit}')"
fi

[[ -n "$DB_CTR" && -n "$WP_CTR" ]] || {
  echo "Could not find running db/wordpress containers for $STACK_NAME" >&2
  exit 1
}

echo_info "Dumping database from $DB_CTR"
docker exec "$DB_CTR" mariadb-dump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  >"$DEST/database.sql"

echo_info "Archiving wp-content from $WP_CTR"
docker exec "$WP_CTR" tar -C /var/www/html -czf - wp-content >"$DEST/wp-content.tar.gz"

cat >"$DEST/manifest.txt" <<EOF
slug=$SLUG
domain=$SITE_DOMAIN
stack=$STACK_NAME
created_at=$STAMP
db_container=$DB_CTR
wp_container=$WP_CTR
EOF

echo_ok "Backup written to $DEST"
ls -lh "$DEST"
