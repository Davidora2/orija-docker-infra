# Architecture

## Goals

- Host many WordPress websites on one Docker host managed by Portainer
- Keep **accounts** (clients / teams) separate from each other
- Scale by adding site stacks — not by rebuilding a monolith
- Stay compatible with orija Portainer rules (high ports, Cloudflare Tunnel, no image builds)

## High-level diagram

```
                     Cloudflare (TLS)
                            │
              hostname per site (DNS / Tunnel)
                            │
                            ▼
              Cloudflare Tunnel on odserver2
                            │
                            ▼
              Traefik  (:18100 on host)     ← stack: wp-platform
                 Host() router per site
                     │         │
                     ▼         ▼
              wp-acme-app   wp-other-app    ← stacks: wp-acme, wp-other
                     │         │
                     ▼         ▼
              wp-acme-db    wp-other-db     ← private internal networks
```

## Components

### 1. Platform stack (`wp-platform`)

| Service | Image | Role |
|---------|-------|------|
| `traefik` | `traefik:v3.6` | HTTP router; reads Docker labels; binds host `18100→80` |
| `redis` | `redis:7-alpine` | Optional shared object cache for WP plugins |
| `landing` | `nginx:1.27-alpine` | Catch-all status page for raw IP access (`:18100`) |

Creates Docker network **`wp-public`** (external for site stacks).

Dashboard: host port `18101` (keep private — do not put on a public tunnel).

### 2. Site stack (`wp-<slug>`)

| Service | Role |
|---------|------|
| `wordpress` | Apache PHP WordPress; joined to `wp-public` + private `wp-<slug>-internal` |
| `db` | Dedicated MariaDB 11; **only** on internal network |

Volumes (named, durable):

- `wp_<slug>_data` — WordPress files / uploads
- `wp_<slug>_db` — database files

Traefik labels on the WordPress container:

```
traefik.http.routers.wp-<slug>.rule=Host(`<domain>`)
```

### 3. Isolation model

| Layer | How |
|-------|-----|
| Process | Separate containers per site |
| Data | Separate named volumes |
| Network | DB on `internal: true` network; only WP can reach it |
| Credentials | Unique MySQL passwords per site (`.env`) |
| WordPress users | Separate WP admin per site (install UI) |
| Portainer RBAC | Separate Portainer user/team per `owner_account` |

### 4. Account → site mapping

`wordpress/sites/registry.yaml` is the source of truth:

```yaml
accounts:
  - id: alice
    portainer_user: alice
sites:
  - slug: acme
    domain: acme.orija.store
    owner_account: alice
    stack_name: wp-acme
```

One account can own many sites. One site has exactly one owner account.

### 5. Scaling strategy

| Scale need | Action |
|------------|--------|
| More websites | `new-site.sh` + deploy another `wp-<slug>` stack |
| More CPU/RAM per site | Portainer → container resources / recreate with limits |
| Separate Docker hosts | Deploy platform + sites on another Portainer endpoint; point tunnels there |
| Shared cache pressure | Raise Redis `maxmemory` in platform compose |
| Backups | Volume backup of `wp_<slug>_data` + `wp_<slug>_db` (see OPERATIONS.md) |

Horizontal scale across hosts is “ship another platform + tunnel”; vertical scale is per-stack resource limits.

### 6. Why not WordPress Multisite?

WordPress Multisite shares one codebase and admin plane. This platform intentionally uses **one WP install per website** so:

- Client A cannot access Client B’s admin or media
- You can delete one site without touching others
- Portainer access can be delegated per stack
- Plugins/themes can differ per site safely

Use Multisite only if you truly need shared users across subsites under one brand — not for multi-tenant hosting.
