# Orija WordPress Hosting Platform

Scalable, Portainer-managed WordPress hosting for **many isolated sites**, each with its own WordPress admin account, database, volumes, and public hostname.

Designed for the Orija Docker host (`portainer.orija.store` → Cloudflare Tunnel → high origin ports).

## What you get

| Piece | Purpose |
|-------|---------|
| **Platform stack** | Shared Redis cache used by all WordPress sites |
| **Site template** | One stack per website: WordPress + MariaDB (full isolation) |
| **Site registry** | Human-readable inventory of every site + account |
| **Provision scripts** | Create a new site in one command (secrets, ports, registry, Portainer) |
| **Docs** | Architecture, day-2 ops, backups, scaling, troubleshooting |

## Mental model

```
Cloudflare DNS / Tunnel
        │
        ▼
  odserver2 high ports (e.g. 19101, 19102, …)
        │
   ┌────┴────┐
   │ Portainer│  stacks: wp-platform, wp-acme, wp-clientb, …
   └────┬────┘
        │
   ┌────┼────────────────────────────┐
   │    │                            │
 Redis  wp-acme (WP+DB)        wp-clientb (WP+DB)
(shared)  admin@acme…            admin@clientb…
```

- **One website = one Portainer stack** (`wp-<slug>`)
- **One WordPress admin account per site** (generated or provided at provision time)
- Sites never share databases or `wp-content` — safe multi-tenant hosting

## Quick start

### 1. Prerequisites

- Docker + Portainer (Orija: already at `https://portainer.orija.store`)
- `PORTAINER_API_TOKEN` secret (Access token from Portainer → My account)
- Cloudflare Tunnel (or other reverse proxy) to map hostnames → origin ports

### 2. Deploy the shared platform (once)

```bash
cd wordpress-hosting
cp platform/.env.example platform/.env   # edit if needed
./scripts/deploy-platform.sh
```

### 3. Provision a new WordPress site

```bash
./scripts/provision-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --title "Acme Marketing" \
  --admin-user acmeadmin \
  --admin-email admin@acme.example \
  --deploy
```

This will:

1. Allocate a free host port
2. Generate DB + WP admin passwords
3. Write `sites/acme/.env` (local secrets; gitignored)
4. Register the site in `sites/registry.yaml`
5. Create/update the Portainer stack `wp-acme` (with `--deploy`)

### 4. Point the tunnel

Map `acme.orija.store` → `http://localhost:<HOST_PORT>` in Cloudflare Tunnel (port printed by the script and stored in the registry).

### 5. Finish WordPress install

Open `https://acme.orija.store` — WordPress uses the env-injected admin credentials (no browser install wizard when `WORDPRESS_CONFIG_EXTRA` / official image env vars are set). Log in at `/wp-admin`.

## Documentation

| Guide | When to read |
|-------|----------------|
| [Architecture](docs/architecture.md) | Understand components & isolation |
| [Adding a site](docs/adding-a-site.md) | Provision, DNS, first login |
| [Managing accounts](docs/managing-accounts.md) | WP users, resets, multi-admin |
| [Portainer ops](docs/portainer-ops.md) | Stacks, API, redeploy |
| [Backups & restore](docs/backups-restore.md) | DB + uploads disaster recovery |
| [Scaling](docs/scaling.md) | More sites, resources, HA options |
| [Troubleshooting](docs/troubleshooting.md) | Common failures |

## Directory layout

```
wordpress-hosting/
├── README.md                 ← you are here
├── docs/                     ← operator manuals
├── platform/                 ← shared Redis stack
├── templates/wordpress-site/ ← compose template for each site
├── sites/
│   ├── registry.yaml         ← inventory (no passwords)
│   └── <slug>/.env           ← per-site secrets (gitignored)
└── scripts/                  ← provision / deploy / list / backup
```

## Security defaults

- Per-site MariaDB user + database (no shared app credentials)
- Strong generated passwords (`openssl`)
- Secrets stay in Portainer env / local `.env` — **never** committed
- No host binds on `80`/`443` (Cloudflare Tunnel pattern)
- Optional Redis Object Cache documented per site

## Related

- Portainer deploy skill: [`.cursor/skills/portainer-deploy/`](../.cursor/skills/portainer-deploy/SKILL.md)
- Repo: `https://github.com/Davidora2/orija-docker-infra`
