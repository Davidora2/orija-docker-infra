# orija-docker-infra

Docker / Portainer infrastructure for Orija — including a **scalable WordPress hosting platform** managed through [Portainer](https://portainer.orija.store).

## WordPress hosting (primary)

Host many isolated WordPress websites on one Docker host. Each site gets its own stack, database, volumes, and WordPress admin account. Cloudflare Tunnel maps each hostname to a high origin port (no host `80`/`443`).

```bash
cd wordpress-hosting
./scripts/deploy-platform.sh          # shared Redis (once)
./scripts/provision-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --title "Acme Marketing" \
  --admin-user acmeadmin \
  --deploy
./scripts/list-sites.sh
```

Full docs: **[wordpress-hosting/README.md](./wordpress-hosting/README.md)**

| Guide | Path |
|-------|------|
| Architecture | [wordpress-hosting/docs/architecture.md](./wordpress-hosting/docs/architecture.md) |
| Add a site | [wordpress-hosting/docs/adding-a-site.md](./wordpress-hosting/docs/adding-a-site.md) |
| Manage accounts | [wordpress-hosting/docs/managing-accounts.md](./wordpress-hosting/docs/managing-accounts.md) |
| Portainer ops | [wordpress-hosting/docs/portainer-ops.md](./wordpress-hosting/docs/portainer-ops.md) |
| Backups | [wordpress-hosting/docs/backups-restore.md](./wordpress-hosting/docs/backups-restore.md) |
| Scaling | [wordpress-hosting/docs/scaling.md](./wordpress-hosting/docs/scaling.md) |

## Portainer for Cloud Agents

Skill: [`.cursor/skills/portainer-deploy/SKILL.md`](./.cursor/skills/portainer-deploy/SKILL.md)

Required secret: `PORTAINER_API_TOKEN`

## Other apps in this repo

`apps/web` contains CreatoMatch (influencer campaign MVP). See [PLAN.md](./PLAN.md) for that product plan.
