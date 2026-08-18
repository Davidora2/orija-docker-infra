# Quick start

Get from zero to a live WordPress site on Portainer.

## Prerequisites

- Access to [Portainer](https://portainer.orija.store)
- Ability to add Cloudflare Tunnel public hostnames for `*.orija.store` (or your domain)
- This repo checked out
- Optional for API deploys: `PORTAINER_API_TOKEN` secret

## Step 1 — Deploy the platform (once per Docker host)

### Option A: Portainer UI

1. **Stacks → Add stack**
2. Name: `wp-platform`
3. Build method: **Repository**
   - URL: `https://github.com/Davidora2/orija-docker-infra`
   - Reference: your branch (e.g. `refs/heads/cursor/wordpress-portainer-hosting-3dd6`)
   - Compose path: `wordpress/platform/compose.yml`
4. Env:
   - `PLATFORM_HTTP_PORT=18100`
   - `PLATFORM_DASHBOARD_PORT=18101`
5. Deploy

### Option B: Script

```bash
export PORTAINER_API_TOKEN=ptr_...
./wordpress/scripts/deploy-platform.sh
```

Confirm containers `wp-traefik` and `wp-redis` are running and network `wp-public` exists.

## Step 2 — Provision a site in git/workdir

```bash
./wordpress/scripts/new-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --owner alice \
  --title "Acme Marketing"
```

Creates:

```
wordpress/sites/acme/
  compose.yml      # Traefik labels + services
  .env             # DB secrets (gitignored)
  site.yaml        # metadata
  CREDENTIALS.txt  # local secrets dump (gitignored)
```

Updates `wordpress/sites/registry.yaml`.

## Step 3 — Deploy the site stack

### Option A: Script (recommended)

```bash
export PORTAINER_API_TOKEN=ptr_...
./wordpress/scripts/deploy-site.sh --slug acme
```

### Option B: Portainer UI

1. **Stacks → Add stack** → name `wp-acme`
2. Build method: **Web editor** — paste `wordpress/sites/acme/compose.yml`
3. Add env vars from `wordpress/sites/acme/.env`
4. Deploy

## Step 4 — Point the domain at the platform

In Cloudflare Zero Trust → Tunnel → Public Hostname:

| Field | Value |
|-------|-------|
| Hostname | `acme.orija.store` |
| Service | `http://localhost:18100` |

All sites share this same origin. Traefik routes by `Host` header.

## Step 5 — Create the WordPress admin (per site)

1. Open `https://acme.orija.store/wp-admin/install.php`
2. Language → site title → **admin username/password/email**
3. That admin belongs only to this site — create different admins for other sites/accounts

DB passwords are in `CREDENTIALS.txt` / `.env` (not the WP admin password).

## Step 6 — Verify

```bash
./wordpress/scripts/list-sites.sh
./wordpress/scripts/validate.sh
curl -fsSI -H "Host: acme.orija.store" http://localhost:18100/   # on the Docker host
```

## Add a second site for another account

```bash
./wordpress/scripts/new-site.sh --slug studio --domain studio.orija.store --owner bob --title "Bob Studios"
./wordpress/scripts/deploy-site.sh --slug studio
# Tunnel: studio.orija.store → http://localhost:18100
```

Alice’s and Bob’s WordPress logins, databases, and stacks stay fully separate.
