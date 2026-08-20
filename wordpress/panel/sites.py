"""Site provisioning logic for the hosting control panel."""
from __future__ import annotations

import json
import os
import re
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from portainer_client import (
    container_states_for_site,
    create_stack_from_string,
    delete_stack,
)

DATA_DIR = Path(os.environ.get("PANEL_DATA_DIR", "/data"))
REGISTRY_PATH = DATA_DIR / "registry.json"

COMPOSE_TEMPLATE = r"""
services:
  db:
    image: mariadb:11.4
    container_name: wp-__SITE_SLUG__-db
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - wp-internal
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 20s
      timeout: 5s
      retries: 10
      start_period: 40s
    labels:
      - "com.orija.stack=wp-__SITE_SLUG__"
      - "com.orija.site=__SITE_SLUG__"
      - "com.orija.role=database"
      - "com.orija.owner=__OWNER_ACCOUNT__"

  wordpress:
    image: wordpress:6.7-php8.2-apache
    container_name: wp-__SITE_SLUG__-app
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: ${MYSQL_USER}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD}
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE}
      WORDPRESS_TABLE_PREFIX: ${WORDPRESS_TABLE_PREFIX:-wp_}
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_HOME', 'https://__SITE_DOMAIN__');
        define('WP_SITEURL', 'https://__SITE_DOMAIN__');
        define('WP_REDIS_HOST', 'wp-redis');
        define('WP_REDIS_PORT', 6379);
        if (isset($$_SERVER['HTTP_X_FORWARDED_PROTO']) && $$_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
          $$_SERVER['HTTPS'] = 'on';
        }
    volumes:
      - wp_data:/var/www/html
    networks:
      - wp-internal
      - wp-public
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://127.0.0.1/wp-admin/install.php >/dev/null || curl -fsS http://127.0.0.1/ >/dev/null || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    labels:
      - "com.orija.stack=wp-__SITE_SLUG__"
      - "com.orija.site=__SITE_SLUG__"
      - "com.orija.role=wordpress"
      - "com.orija.owner=__OWNER_ACCOUNT__"
      - "com.orija.domain=__SITE_DOMAIN__"
      - "traefik.enable=true"
      - "traefik.docker.network=wp-public"
      - "traefik.http.routers.wp-__SITE_SLUG__.rule=Host(`__SITE_DOMAIN__`)"
      - "traefik.http.routers.wp-__SITE_SLUG__.entrypoints=web"
      - "traefik.http.routers.wp-__SITE_SLUG__.service=wp-__SITE_SLUG__"
      - "traefik.http.services.wp-__SITE_SLUG__.loadbalancer.server.port=80"
      - "traefik.http.middlewares.wp-__SITE_SLUG__-headers.headers.customrequestheaders.X-Forwarded-Proto=https"
      - "traefik.http.routers.wp-__SITE_SLUG__.middlewares=wp-__SITE_SLUG__-headers"

  wp-init:
    image: wordpress:cli-php8.2
    container_name: wp-__SITE_SLUG__-init
    restart: on-failure
    depends_on:
      wordpress:
        condition: service_healthy
      db:
        condition: service_healthy
    user: "33:33"
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: ${MYSQL_USER}
      WORDPRESS_DB_PASSWORD: ${MYSQL_PASSWORD}
      WORDPRESS_DB_NAME: ${MYSQL_DATABASE}
    volumes:
      - wp_data:/var/www/html
    networks:
      - wp-internal
    entrypoint:
      - /bin/sh
      - -ec
      - |
        i=0
        while [ ! -f /var/www/html/wp-settings.php ]; do
          i=$$((i+1)); [ "$$i" -gt 60 ] && exit 1; sleep 2
        done
        if wp core is-installed 2>/dev/null; then
          echo already-installed; exit 0
        fi
        wp core install \
          --url="https://__SITE_DOMAIN__" \
          --title="__SITE_TITLE__" \
          --admin_user="__WP_ADMIN_USER__" \
          --admin_password="__WP_ADMIN_PASSWORD__" \
          --admin_email="__WP_ADMIN_EMAIL__" \
          --skip-email
        wp rewrite structure '/%postname%/' || true
        echo install-complete

networks:
  wp-internal:
    name: wp-__SITE_SLUG__-internal
    driver: bridge
    internal: true
  wp-public:
    external: true
    name: wp-public

volumes:
  db_data:
    name: wp___SITE_SLUG___db
  wp_data:
    name: wp___SITE_SLUG___data
""".lstrip()


def _ensure_data() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not REGISTRY_PATH.exists():
        REGISTRY_PATH.write_text(json.dumps({"sites": []}, indent=2))


def load_registry() -> dict[str, Any]:
    _ensure_data()
    return json.loads(REGISTRY_PATH.read_text())


def save_registry(data: dict[str, Any]) -> None:
    _ensure_data()
    REGISTRY_PATH.write_text(json.dumps(data, indent=2))


def slugify(title: str, explicit: str | None = None) -> str:
    raw = (explicit or title).strip().lower()
    raw = re.sub(r"[^a-z0-9-]+", "-", raw)
    raw = re.sub(r"-{2,}", "-", raw).strip("-")
    if not raw or not re.match(r"^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$", raw):
        raise ValueError("Use a short name with letters and numbers only (e.g. my-shop)")
    return raw


def gen_password(length: int = 24) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def list_sites() -> list[dict[str, Any]]:
    sites = load_registry().get("sites") or []
    for s in sites:
        states = container_states_for_site(s["slug"])
        s["runtime"] = states
        if states.get("wordpress") == "running":
            s["health"] = "running"
        elif states:
            s["health"] = "starting"
        else:
            s["health"] = s.get("status", "unknown")
    return sorted(sites, key=lambda x: x.get("created_at", ""), reverse=True)


def get_site(slug: str) -> dict[str, Any] | None:
    for s in list_sites():
        if s.get("slug") == slug:
            return s
    return None


def create_site(
    *,
    title: str,
    domain: str,
    admin_email: str,
    admin_user: str = "admin",
    slug: str | None = None,
    owner: str = "cursor",
) -> dict[str, Any]:
    site_slug = slugify(title, slug)
    domain = domain.strip().lower()
    if not domain or "." not in domain:
        raise ValueError("Enter a full web address like mybiz.orija.store")
    if not admin_email or "@" not in admin_email:
        raise ValueError("Enter a valid email address")

    reg = load_registry()
    for s in reg.get("sites") or []:
        if s["slug"] == site_slug:
            raise ValueError(f"A site named '{site_slug}' already exists")
        if s.get("domain") == domain:
            raise ValueError(f"Domain {domain} is already used by another site")

    admin_password = gen_password(20)
    mysql_password = gen_password(28)
    mysql_root = gen_password(28)

    compose = (
        COMPOSE_TEMPLATE.replace("__SITE_SLUG__", site_slug)
        .replace("__SITE_DOMAIN__", domain)
        .replace("__OWNER_ACCOUNT__", owner)
        .replace("__SITE_TITLE__", title.replace('"', ""))
        .replace("__WP_ADMIN_USER__", admin_user)
        .replace("__WP_ADMIN_PASSWORD__", admin_password)
        .replace("__WP_ADMIN_EMAIL__", admin_email)
    )

    # Escape for shell in entrypoint: passwords already alphanumeric
    env = [
        {"name": "MYSQL_DATABASE", "value": "wordpress"},
        {"name": "MYSQL_USER", "value": "wp_user"},
        {"name": "MYSQL_PASSWORD", "value": mysql_password},
        {"name": "MYSQL_ROOT_PASSWORD", "value": mysql_root},
        {"name": "WORDPRESS_TABLE_PREFIX", "value": "wp_"},
    ]

    try:
        create_stack_from_string(f"wp-{site_slug}", compose, env)
    except Exception:
        raise

    entry = {
        "slug": site_slug,
        "domain": domain,
        "title": title,
        "owner_account": owner,
        "stack_name": f"wp-{site_slug}",
        "status": "deployed",
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "admin_user": admin_user,
        "admin_email": admin_email,
        "admin_password": admin_password,
        "tunnel_origin": "http://localhost:18100",
        "dns_hint": f"Point {domain} → http://localhost:18100 in Cloudflare Tunnel",
    }
    reg.setdefault("sites", []).append(entry)
    save_registry(reg)

    # Persist secrets separately (same volume)
    secrets_path = DATA_DIR / f"{site_slug}.secrets.json"
    secrets_path.write_text(
        json.dumps(
            {
                "admin_user": admin_user,
                "admin_password": admin_password,
                "admin_email": admin_email,
                "mysql_password": mysql_password,
            },
            indent=2,
        )
    )
    secrets_path.chmod(0o600)

    return entry


def remove_site(slug: str, delete_stack_flag: bool = True) -> None:
    reg = load_registry()
    sites = [s for s in reg.get("sites") or [] if s.get("slug") != slug]
    if len(sites) == len(reg.get("sites") or []):
        raise ValueError("Site not found")
    if delete_stack_flag:
        delete_stack(f"wp-{slug}")
    reg["sites"] = sites
    save_registry(reg)
    sp = DATA_DIR / f"{slug}.secrets.json"
    if sp.exists():
        sp.unlink()


def import_existing_from_yaml(path: Path) -> int:
    """Optional one-time import from wordpress/sites/registry.yaml shape."""
    if not path.exists():
        return 0
    data = yaml.safe_load(path.read_text()) or {}
    reg = load_registry()
    known = {s["slug"] for s in reg.get("sites") or []}
    added = 0
    for s in data.get("sites") or []:
        if s.get("status") == "example":
            continue
        if s.get("slug") in known:
            continue
        reg.setdefault("sites", []).append(
            {
                "slug": s["slug"],
                "domain": s["domain"],
                "title": s.get("title") or s["slug"],
                "owner_account": s.get("owner_account", "cursor"),
                "stack_name": s.get("stack_name") or f"wp-{s['slug']}",
                "status": s.get("status", "imported"),
                "created_at": f"{s.get('created', '2026-01-01')}T00:00:00Z",
                "admin_user": "",
                "admin_email": "",
                "admin_password": "",
                "tunnel_origin": "http://localhost:18100",
                "dns_hint": f"Point {s['domain']} → http://localhost:18100 in Cloudflare Tunnel",
            }
        )
        added += 1
    if added:
        save_registry(reg)
    return added
