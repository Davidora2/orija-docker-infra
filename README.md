# orija-docker-infra

Docker / Portainer infrastructure for the orija host (`portainer.orija.store`).

## WordPress hosting (multi-site)

Scalable WordPress platform: one shared Traefik edge (`wp-platform`), many isolated site stacks (`wp-<slug>`), account → site registry, and Portainer-friendly deploy scripts.

```bash
./wordpress/scripts/new-site.sh --slug acme --domain acme.orija.store --owner alice
./wordpress/scripts/deploy-platform.sh   # needs PORTAINER_API_TOKEN
./wordpress/scripts/deploy-site.sh --slug acme
```

Full docs: **[wordpress/README.md](wordpress/README.md)**

| Doc | Topic |
|-----|--------|
| [Architecture](wordpress/docs/ARCHITECTURE.md) | Traefik, isolation, scaling |
| [Quick start](wordpress/docs/QUICKSTART.md) | First site end-to-end |
| [Multi-account](wordpress/docs/MULTI-ACCOUNT.md) | Portainer users ↔ WP admins |
| [Operations](wordpress/docs/OPERATIONS.md) | Backups, updates, troubleshooting |
| [Portainer](wordpress/docs/PORTAINER.md) | API, tunnels, ports |

## Other apps in this repo

`apps/web` contains CreatoMatch (UGC campaign MVP). See that app’s README for local Node development.

## Portainer skill

Cloud Agents: `.cursor/skills/portainer-deploy/SKILL.md`
