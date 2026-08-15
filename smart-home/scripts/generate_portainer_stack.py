#!/usr/bin/env python3
"""Generate a self-contained Portainer stack (no git clone at runtime).

Packs smart-home source into a base64 tarball embedded in portainer-stack.yml.
Git remains for version control only — Portainer never clones.
"""

from __future__ import annotations

import base64
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "portainer-stack.yml"

INCLUDE_DIRS = [
    ROOT / "shared",
    ROOT / "services",
    ROOT / "config",
    ROOT / "scripts",
    ROOT / "web",
    ROOT / "docs",
]


def build_bundle() -> str:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in INCLUDE_DIRS:
            if not path.exists():
                continue
            for file in path.rglob("*"):
                if not file.is_file():
                    continue
                if "__pycache__" in file.parts or file.suffix in {".pyc"}:
                    continue
                if "egg-info" in file.parts or file.name.endswith(".egg-info"):
                    continue
                arcname = file.relative_to(ROOT).as_posix()
                tar.add(file, arcname=arcname)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def service_block(
    name: str,
    *,
    role: str,
    depends: str,
    health: bool = False,
    extra_env: str = "",
    extra_volumes: str = "",
) -> str:
    # Portainer compose up fails if healthchecks stay non-healthy during long pip installs.
    # Keep services restarting; omit Docker healthchecks in the Portainer stack.
    _ = health
    health_yaml = ""

    if role == "registry":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/home-registry/requirements.txt
        cp /app/services/home-registry/app.py /run/app.py
        cd /run
        exec uvicorn app:app --host 0.0.0.0 --port 8000"""
    elif role == "ring":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/ring-ingest/requirements.txt
        cp /app/services/ring-ingest/app.py /run/app.py
        cd /run
        exec uvicorn app:app --host 0.0.0.0 --port 8000"""
    elif role == "mqtt-ingest":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/mqtt-ingest/requirements.txt
        cp /app/services/mqtt-ingest/worker.py /run/worker.py
        cd /run
        exec python worker.py"""
    elif role == "rules":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/rules-engine/requirements.txt
        cp /app/services/rules-engine/worker.py /run/worker.py
        cd /run
        exec python worker.py"""
    elif role == "notifier":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/notifier/requirements.txt
        cp /app/services/notifier/worker.py /run/worker.py
        cd /run
        exec python worker.py"""
    elif role == "mqtt-commander":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/mqtt-commander/requirements.txt
        cp /app/services/mqtt-commander/worker.py /run/worker.py
        cd /run
        exec python worker.py"""
    elif role == "scheduler":
        run = """
        cp -a /app/shared /tmp/shared
        pip install --no-cache-dir -q /tmp/shared -r /app/services/scheduler/requirements.txt
        cp /app/services/scheduler/worker.py /run/worker.py
        cd /run
        exec python worker.py"""
    else:
        raise ValueError(role)

    install_curl = ""

    return f"""
  {name}:
    image: python:3.12-slim
    restart: unless-stopped
    working_dir: /run
    environment:
{extra_env}
    volumes:
      - homepulse-app:/app:ro
{extra_volumes}
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        set -eu
        test -f /app/shared/pyproject.toml || (echo "App bundle missing — redeploy stack" && exit 1)
{install_curl}
{run}
    depends_on:
{depends}
{health_yaml}
    networks: [homepulse]
"""


def main() -> None:
    bundle = build_bundle()
    # Split for readability / avoid some parsers choking; join in shell
    chunk_size = 80
    chunks = [bundle[i : i + chunk_size] for i in range(0, len(bundle), chunk_size)]
    # YAML-safe: append via printf (no nested heredoc terminator issues)
    bundle_printfs = "\n".join(
        f"        printf '%s' '{c}' >> bundle.b64" for c in chunks
    )

    content = f"""# HomePulse — self-contained Portainer stack (ORIJA)
# Gateway: http://HOST:18091
# Cloudflare Tunnel (you configure): public hostname → http://localhost:18091
# Admin UI: https://HOST/admin/  (bootstrap token = BOOTSTRAP_ADMIN_TOKEN)
#
# NO GIT CLONE at runtime. App source is embedded (base64 tarball) below.
# Git is for version control only — regenerate this file with:
#   python3 smart-home/scripts/generate_portainer_stack.py
#
# Required env: POSTGRES_PASSWORD, API_KEY_PEPPER, BOOTSTRAP_ADMIN_TOKEN
# Optional: GATEWAY_PORT=18091, FCM_MODE=dry_run

name: homepulse

services:
  seed:
    image: busybox:1.37
    restart: "no"
    volumes:
      - homepulse-app:/app
      - homepulse-frigate-config:/frigate-config
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        set -eu
        cd /tmp
        : > bundle.b64
{bundle_printfs}
        base64 -d bundle.b64 | tar -xz -C /app
        # Ensure previous extract cannot leave stale admin/UI files behind
        echo "HomePulse app bundle extracted:"
        ls -la /app
        ls -la /app/services
        ls -la /app/web/admin || true
        ls -la /app/web/app || true
        mkdir -p /frigate-config
        if [ -f /app/config/frigate/config.yml ]; then
          cp /app/config/frigate/config.yml /frigate-config/config.yml
          echo "Seeded Frigate config (14-day retain)"
        fi
    networks: [homepulse]

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${{POSTGRES_DB:-homepulse}}
      POSTGRES_USER: ${{POSTGRES_USER:-homepulse}}
      POSTGRES_PASSWORD: ${{POSTGRES_PASSWORD}}
    volumes:
      - homepulse-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${{POSTGRES_USER:-homepulse}} -d ${{POSTGRES_DB:-homepulse}}"]
      interval: 5s
      timeout: 5s
      retries: 12
    networks: [homepulse]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--save", "60", "1"]
    volumes:
      - homepulse-redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 12
    networks: [homepulse]

  mosquitto:
    image: eclipse-mosquitto:2
    restart: unless-stopped
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        set -eu
        mkdir -p /mosquitto/config
        printf 'listener 1883\\nallow_anonymous true\\npersistence false\\n' > /mosquitto/config/mosquitto.conf
        exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
    networks: [homepulse]
{service_block(
        "home-registry",
        role="registry",
        health=False,
        depends="""      seed:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy""",
        extra_env="""      DATABASE_URL: postgresql+psycopg://${POSTGRES_USER:-homepulse}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-homepulse}
      API_KEY_PEPPER: ${API_KEY_PEPPER}
      BOOTSTRAP_ADMIN_TOKEN: ${BOOTSTRAP_ADMIN_TOKEN}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:-}
      REDIS_URL: redis://redis:6379/0
      FRIGATE_BASE_URL: ${FRIGATE_BASE_URL:-http://frigate:5000}
      FRIGATE_CONFIG_PATH: /frigate-config/config.yml
      FRIGATE_MQTT_HOST: mosquitto
      PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:-}""",
        extra_volumes="""      - homepulse-frigate-config:/frigate-config""",
    )}
{service_block(
        "ring-ingest",
        role="ring",
        health=False,
        depends="""      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      home-registry:
        condition: service_started""",
        extra_env="""      REDIS_URL: redis://redis:6379/0
      REGISTRY_URL: http://home-registry:8000
      RING_WEBHOOK_SECRET: ${RING_WEBHOOK_SECRET:-}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}""",
    )}
{service_block(
        "mqtt-ingest",
        role="mqtt-ingest",
        depends="""      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      home-registry:
        condition: service_started
      mosquitto:
        condition: service_started""",
        extra_env="""      REDIS_URL: redis://redis:6379/0
      REGISTRY_URL: http://home-registry:8000
      MQTT_HOST: mosquitto
      MQTT_PORT: 1883
      FRIGATE_BASE_URL: ${FRIGATE_BASE_URL:-http://frigate:5000}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}""",
    )}
{service_block(
        "rules-engine",
        role="rules",
        depends="""      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      home-registry:
        condition: service_started""",
        extra_env="""      REDIS_URL: redis://redis:6379/0
      REGISTRY_URL: http://home-registry:8000
      FRIGATE_BASE_URL: ${FRIGATE_BASE_URL:-http://frigate:5000}
      PORCH_LIGHT_MINUTES: ${PORCH_LIGHT_MINUTES:-5}
      SIREN_SECONDS: ${SIREN_SECONDS:-30}
      NOTIFY_ON_MOTION: ${NOTIFY_ON_MOTION:-false}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      HOSTNAME: rules-1""",
    )}
{service_block(
        "notifier",
        role="notifier",
        depends="""      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      home-registry:
        condition: service_started""",
        extra_env="""      REDIS_URL: redis://redis:6379/0
      REGISTRY_URL: http://home-registry:8000
      FCM_MODE: ${FCM_MODE:-dry_run}
      FCM_PROJECT_ID: ${FCM_PROJECT_ID:-}
      GOOGLE_APPLICATION_CREDENTIALS: ${GOOGLE_APPLICATION_CREDENTIALS:-}
      GOOGLE_HOME_MODE: ${GOOGLE_HOME_MODE:-cast}
      GOOGLE_HOME_LANG: ${GOOGLE_HOME_LANG:-en}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY:-}
      VAPID_PRIVATE_KEY_FILE: ${VAPID_PRIVATE_KEY_FILE:-/secrets/vapid-private.pem}
      VAPID_SUBJECT: ${VAPID_SUBJECT:-mailto:admin@homepulse.local}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      HOSTNAME: notifier-1""",
        extra_volumes="      - homepulse-secrets:/secrets:ro",
    )}
{service_block(
        "mqtt-commander",
        role="mqtt-commander",
        depends="""      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      home-registry:
        condition: service_started
      mosquitto:
        condition: service_started""",
        extra_env="""      REDIS_URL: redis://redis:6379/0
      REGISTRY_URL: http://home-registry:8000
      MQTT_HOST: mosquitto
      MQTT_PORT: 1883
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      HOSTNAME: mqtt-commander-1""",
    )}
{service_block(
        "scheduler",
        role="scheduler",
        depends="""      seed:
        condition: service_completed_successfully
      redis:
        condition: service_healthy
      home-registry:
        condition: service_started""",
        extra_env="""      REDIS_URL: redis://redis:6379/0
      REGISTRY_URL: http://home-registry:8000
      LOCK_CHECK_INTERVAL_SECONDS: ${LOCK_CHECK_INTERVAL_SECONDS:-60}
      SUNSET_HOUR_LOCAL: ${SUNSET_HOUR_LOCAL:-20}
      SUNSET_MINUTE_LOCAL: ${SUNSET_MINUTE_LOCAL:-0}
      AUTO_LOCK_AFTER_SUNSET: ${AUTO_LOCK_AFTER_SUNSET:-true}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}""",
    )}
  frigate:
    image: ghcr.io/blakeblackshear/frigate:stable
    restart: unless-stopped
    shm_size: "256mb"
    environment:
      FRIGATE_RTSP_PASSWORD: ${{FRIGATE_RTSP_PASSWORD:-homepulse}}
    volumes:
      - homepulse-frigate-config:/config
      - homepulse-frigate-media:/media/frigate
      - type: tmpfs
        target: /tmp/cache
        tmpfs:
          size: 512000000
    depends_on:
      seed:
        condition: service_completed_successfully
      mosquitto:
        condition: service_started
      home-registry:
        condition: service_started
    networks: [homepulse]

  gateway:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "${{GATEWAY_PORT:-18091}}:8080"
    volumes:
      - homepulse-app:/app:ro
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        set -eu
        cp /app/config/nginx/nginx.conf /etc/nginx/nginx.conf
        exec nginx -g 'daemon off;'
    depends_on:
      seed:
        condition: service_completed_successfully
      home-registry:
        condition: service_started
      ring-ingest:
        condition: service_started
      frigate:
        condition: service_started
    networks: [homepulse]

networks:
  homepulse:
    driver: bridge

volumes:
  homepulse-app:
  homepulse-pgdata:
  homepulse-redis:
  homepulse-secrets:
  homepulse-frigate-config:
  homepulse-frigate-media:
"""
    # Convert doubled compose interpolations written as ${{VAR}} → ${VAR}
    import re

    content = re.sub(r"\$\{\{([^{}]+)\}\}", r"${\1}", content)
    OUT.write_text(content)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, bundle {len(bundle)} b64 chars)")


if __name__ == "__main__":
    main()
