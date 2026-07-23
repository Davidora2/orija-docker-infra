#!/usr/bin/env bash
# Build OrijaFlix image on the Docker host (run once after cloning the private repo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose -f docker-compose.local.yml build
docker tag orijaflix:local orijaflix:latest
echo "Image ready: orijaflix:latest"
echo "Deploy docker-compose.portainer.yml in Portainer (Web editor) — no Git build needed."
