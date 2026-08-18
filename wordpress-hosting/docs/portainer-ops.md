# Portainer operations

Orija Portainer: **https://portainer.orija.store**

## Auth

Use an **access token**, never the admin password in scripts.

```bash
export PORTAINER_URL=https://portainer.orija.store
export PORTAINER_API_TOKEN=ptr_…   # Cursor Environment secret
```

Verify:

```bash
curl -fsS -H "X-API-Key: $PORTAINER_API_TOKEN" "$PORTAINER_URL/api/status"
curl -fsS -H "X-API-Key: $PORTAINER_API_TOKEN" "$PORTAINER_URL/api/endpoints"
```

Known defaults (confirm each run):

| Item | Value |
|------|-------|
| Endpoint name | `local` |
| Endpoint id | often `3` |
| Docker host | `odserver2` |

## Stacks used by this platform

| Stack | Compose in git |
|-------|----------------|
| `wp-platform` | `wordpress-hosting/platform/docker-compose.yml` |
| `wp-<slug>` | `wordpress-hosting/templates/wordpress-site/docker-compose.yml` |

Create/redeploy helpers:

```bash
./scripts/deploy-platform.sh          # shared Redis
./scripts/deploy-site.sh <slug>       # one WordPress site
./scripts/list-sites.sh --portainer   # registry + API
```

## Orija compose rules (required)

1. Do **not** publish host `80`/`443`
2. Publish WordPress on a high port (`HOST_PORT`)
3. Map Cloudflare Tunnel hostname → `http://localhost:$HOST_PORT`
4. Avoid Docker `build:` in Portainer creates (prefer public images)
5. Prefer git-based stacks so Cloud Agents can redeploy by ref

## Manual create in the UI

1. Stacks → Add stack → Repository
2. Name: `wp-acme`
3. Repo URL: `https://github.com/Davidora2/orija-docker-infra`
4. Reference: `refs/heads/<your-branch>`
5. Compose path: `wordpress-hosting/templates/wordpress-site/docker-compose.yml`
6. Paste env vars from `sites/acme/.env`
7. Deploy

## Redeploy after template changes

Push compose changes, then:

```bash
GIT_REF=refs/heads/cursor/wordpress-portainer-hosting-4648 \
  ./scripts/deploy-site.sh acme
```

Or in the UI: stack → Pull and redeploy.

## Logs

Portainer → Stack → Container → Logs  

Useful containers: `wordpress`, `db`, `wp-init`.

## Removing a site

```bash
./scripts/remove-site.sh acme --delete-stack
```

Volumes (`<slug>_db`, `<slug>_wp_html`) remain on the Docker host until you delete them manually — intentional data safety.

## Cloud Agent skill

See [`.cursor/skills/portainer-deploy/SKILL.md`](../../.cursor/skills/portainer-deploy/SKILL.md) for generic Portainer API patterns used across Orija stacks.
