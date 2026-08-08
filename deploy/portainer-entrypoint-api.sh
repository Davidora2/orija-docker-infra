#!/bin/sh
set -eu

REPO_URL="${LIFE_OS_REPO_URL:-https://github.com/Davidora2/orija-docker-infra.git}"
REPO_REF="${LIFE_OS_REPO_REF:-refs/heads/cursor/life-os-planning-docs-c38b}"
ROOT=/opt/life-os

if [ ! -f "$ROOT/.bootstrap-ok" ]; then
  apk add --no-cache git >/dev/null
  rm -rf "$ROOT"
  git clone --depth 1 --branch "${REPO_REF#refs/heads/}" "$REPO_URL" "$ROOT"
  cd "$ROOT"
  corepack enable
  pnpm install --frozen-lockfile --filter life-os-api...
  pnpm --filter life-os-api build
  touch "$ROOT/.bootstrap-ok"
fi

cd "$ROOT/apps/api"
exec node dist/server.js
