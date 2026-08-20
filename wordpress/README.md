# WordPress multi-site hosting on Portainer (orija)

Scalable WordPress hosting for **https://portainer.orija.store**: one shared edge proxy, many isolated site stacks, one Portainer account (or team) per client/owner.

## What you get

| Piece | Purpose |
|-------|---------|
| `wp-platform` stack | Traefik reverse proxy + shared Redis on high port `18100` |
| `wp-<slug>` stacks | One WordPress + MariaDB per website (isolated volumes/network) |
| `sites/registry.yaml` | Inventory of accounts → websites → domains |
| Scripts | Provision, list, remove, validate, deploy |
| Docs | Architecture, ops, multi-account, Portainer & tunnel |

## Easiest way (recommended) — Hosting Control Panel

Use the **Bluehost-style dashboard** in your browser:

1. Open **https://hosting.orija.store** (after tunnel is set)
2. Sign in with your panel password
3. Click **Create website**
4. Manage all sites from one place

Deploy the panel once: `./wordpress/scripts/deploy-panel.sh`  
Docs: [panel/README.md](panel/README.md)

## Advanced / script quick start

```bash
# 1) Deploy shared platform (once)
./wordpress/scripts/deploy-platform.sh
# or Portainer UI → Add stack from git: wordpress/platform/compose.yml

# 2) Provision a site locally (generates compose + secrets)
./wordpress/scripts/new-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --owner alice \
  --title "Acme Marketing"

# 3) Deploy that site to Portainer
./wordpress/scripts/deploy-site.sh --slug acme

# 4) Cloudflare Tunnel: acme.orija.store → http://localhost:18100

# 5) Open https://acme.orija.store/wp-admin/install.php
#    Create the WordPress admin user for that site only
```

## Layout

```
wordpress/
  platform/           # Shared Traefik + Redis (wp-platform)
  templates/site/     # Blueprint for each website
  sites/              # Generated per-site stacks + registry.yaml
  scripts/            # new-site, deploy-*, list, remove, validate
  docs/               # Full documentation
  portainer/          # Stack template notes for Portainer UI
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Quick start & first site](docs/QUICKSTART.md)
- [Multi-account management](docs/MULTI-ACCOUNT.md)
- [Day-2 operations](docs/OPERATIONS.md)
- [Portainer + Cloudflare Tunnel](docs/PORTAINER.md)

## Design rules (orija host)

- Do **not** bind host `:80` / `:443` — publish Traefik on `18100`
- Cloudflare Tunnel terminates TLS and forwards to `http://localhost:18100`
- No `build:` steps — official images only (Portainer-friendly)
- Each site has its own DB credentials and WordPress admin (created at install)

## Validate offline

```bash
./wordpress/scripts/validate.sh
./wordpress/scripts/list-sites.sh
```
