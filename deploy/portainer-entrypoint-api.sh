#!/bin/sh
set -eu

REPO_URL="${LIFE_OS_REPO_URL:-https://github.com/Davidora2/orija-docker-infra.git}"
REPO_REF="${LIFE_OS_REPO_REF:-refs/heads/cursor/life-os-planning-docs-c38b}"
BRANCH="${REPO_REF#refs/heads/}"
ROOT=/opt/life-os

mkdir -p "$ROOT"
cd "$ROOT"

if [ ! -f "$ROOT/.bootstrap-ok" ]; then
  echo "Bootstrapping Life OS API from $BRANCH..."
  apk add --no-cache git
  rm -rf "$ROOT/repo"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$ROOT/repo"
  cd "$ROOT/repo"
  corepack enable
  corepack prepare pnpm@10.33.3 --activate
  pnpm install --frozen-lockfile --filter life-os-api...
  pnpm --filter life-os-api build
  touch "$ROOT/.bootstrap-ok"
  echo "API bootstrap complete."
fi

cd "$ROOT/repo/apps/api"
exec node dist/server.js
