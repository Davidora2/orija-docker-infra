#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -f .env.production ]; then
  echo "Missing .env.production. Copy .env.production.example and set real secrets."
  exit 1
fi

docker compose \
  --env-file .env.production \
  -f compose.production.yml \
  up -d --build --remove-orphans

DOMAIN=$(awk -F= '$1 == "LIFE_OS_DOMAIN" { print $2 }' .env.production)
if [ -z "$DOMAIN" ]; then
  echo "LIFE_OS_DOMAIN is missing from .env.production."
  exit 1
fi

attempt=1
while [ "$attempt" -le 30 ]; do
  if curl --fail --silent --show-error "https://$DOMAIN/api/health" >/dev/null; then
    echo "Life OS is healthy at https://$DOMAIN"
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 5
done

echo "Deployment started, but the public health check did not become ready."
docker compose --env-file .env.production -f compose.production.yml ps
exit 1
