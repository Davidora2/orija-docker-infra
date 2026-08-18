# Architecture

## Goals

1. Host many WordPress websites on one Docker host managed by Portainer
2. Give each website its **own WordPress admin account** (and DB)
3. Scale by adding more stacks, not by editing a giant monolith compose file
4. Stay compatible with Orija’s Cloudflare Tunnel pattern (no host `80`/`443`)

## Components

```
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare (DNS + Tunnel)                                   │
│  acme.orija.store ──► localhost:19101                       │
│  clientb.orija.store ► localhost:19102                      │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│ Docker host (odserver2)                                     │
│                                                             │
│  Portainer UI/API  https://portainer.orija.store            │
│                                                             │
│  Stack: wp-platform                                         │
│    └─ redis (network: wp-platform)                          │
│                                                             │
│  Stack: wp-acme                                             │
│    ├─ mariadb   volume: acme_db                             │
│    ├─ wordpress volume: acme_wp_html  port 19101→80         │
│    └─ wp-init   one-shot WP-CLI install + admin user        │
│                                                             │
│  Stack: wp-clientb                                          │
│    ├─ mariadb   volume: clientb_db                          │
│    ├─ wordpress volume: clientb_wp_html port 19102→80       │
│    └─ wp-init                                               │
└─────────────────────────────────────────────────────────────┘
```

## Isolation model

| Resource | Shared? | Why |
|----------|---------|-----|
| MariaDB server | **No** — one DB container per site | Blast radius, easy delete/migrate |
| Database credentials | **No** | Different WP accounts / tenants |
| `wp-content` / HTML volume | **No** | Themes, plugins, uploads stay private |
| Redis | **Yes** (optional) | Cheap object cache; keys prefixed by `SITE_SLUG:` |
| Docker network `wp-platform` | **Yes** | Sites reach Redis by hostname `redis` |
| Host ports | Unique per site | Tunnel origin mapping |

This is **multi-site hosting**, not WordPress Multisite. Multisite shares one admin network and DB; here each customer/account gets a fully separate install.

## Why not WordPress Multisite?

Use Multisite only when **one organization** needs many subsites under one login.  
Use this platform when **different accounts / clients** must not see each other’s data, plugins, or users.

## Portainer stack naming

| Stack | Role |
|-------|------|
| `wp-platform` | Shared Redis + `wp-platform` network |
| `wp-<slug>` | One website |

Compose files live in git so stacks can be created with Portainer’s **repository** deploy and redeployed with git pull.

## Config & secrets flow

```
provision-site.sh
   │
   ├─► sites/<slug>/.env          (gitignored secrets)
   ├─► sites/<slug>/credentials.txt (one-time; move to password manager)
   └─► sites/registry.yaml        (public inventory: domain, port, admin user)

deploy-site.sh
   │
   └─► Portainer stack Env[]      (runtime source of truth on the host)
```

## First-boot install

The `wp-init` service runs WP-CLI:

1. Waits for WordPress core files from the `wordpress` container
2. Skips if already installed
3. Otherwise runs `wp core install` with the provisioned admin user/password/email
4. Sets permalinks and optionally enables Redis Object Cache

## Scaling levers

See [scaling.md](scaling.md). Short version:

- Horizontal: more `wp-<slug>` stacks (primary path)
- Vertical: raise `WP_MEMORY_LIMIT`, MariaDB / Redis memory
- Host: more CPU/RAM or a second Portainer endpoint + registry port ranges
