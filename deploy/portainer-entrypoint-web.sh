#!/bin/sh
set -eu

REPO_URL="${LIFE_OS_REPO_URL:-https://github.com/Davidora2/orija-docker-infra.git}"
REPO_REF="${LIFE_OS_REPO_REF:-refs/heads/cursor/life-os-planning-docs-c38b}"
BRANCH="${REPO_REF#refs/heads/}"
ROOT=/opt/life-os

mkdir -p "$ROOT"
cd "$ROOT"

if [ ! -f "$ROOT/.bootstrap-ok" ]; then
  echo "Bootstrapping Life OS web from $BRANCH..."
  apk add --no-cache git
  rm -rf "$ROOT/repo"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$ROOT/repo"
  cd "$ROOT/repo"
  corepack enable
  corepack prepare pnpm@10.33.3 --activate
  pnpm install --frozen-lockfile --filter life-os...
  pnpm --filter life-os build
  mkdir -p "$ROOT/runtime"
  cp -a "$ROOT/repo/apps/life-os/.next/standalone/." "$ROOT/runtime/"
  mkdir -p "$ROOT/runtime/apps/life-os/.next"
  cp -a "$ROOT/repo/apps/life-os/.next/static" "$ROOT/runtime/apps/life-os/.next/static"
  touch "$ROOT/.bootstrap-ok"
  echo "Web bootstrap complete."
fi

cd "$ROOT/runtime"
exec node apps/life-os/server.js
