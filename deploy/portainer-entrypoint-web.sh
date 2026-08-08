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
  pnpm install --frozen-lockfile --filter life-os...
  pnpm --filter life-os build
  # standalone output lives under apps/life-os/.next/standalone
  mkdir -p "$ROOT/runtime"
  cp -a "$ROOT/apps/life-os/.next/standalone/." "$ROOT/runtime/"
  mkdir -p "$ROOT/runtime/apps/life-os/.next"
  cp -a "$ROOT/apps/life-os/.next/static" "$ROOT/runtime/apps/life-os/.next/static"
  touch "$ROOT/.bootstrap-ok"
fi

cd "$ROOT/runtime"
exec node apps/life-os/server.js
