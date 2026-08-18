# Portainer & Cloudflare Tunnel

How this WordPress platform fits the orija Docker host.

## Portainer defaults

| Item | Value |
|------|--------|
| URL | `https://portainer.orija.store` |
| Auth | API token header `X-API-Key` (secret `PORTAINER_API_TOKEN`) |
| Typical endpoint | `local` (confirm id via `/api/endpoints`) |
| Docker host | `odserver2` |

Never commit `ptr_…` tokens.

## Stack naming

| Stack | Compose | Deploy method |
|-------|---------|---------------|
| `wp-platform` | `wordpress/platform/compose.yml` | Git repository (shared, no secrets) |
| `wp-<slug>` | `wordpress/sites/<slug>/compose.yml` | **String/inline** + env (keeps DB passwords out of git) |

## Host networking rules

1. Do **not** publish container ports `80`/`443` on the host
2. Platform publishes **`18100:80`** (HTTP origin for the tunnel)
3. Dashboard **`18101:8080`** — leave off public tunnels
4. No `build:` keys — pull Hub images only

## Cloudflare Tunnel

One tunnel origin serves every WordPress hostname:

```
Public hostname:  <site-domain>
Path:             (empty)
Service type:     HTTP
URL:              localhost:18100
```

Add one public hostname row per site domain. Traefik selects the backend with `Host(<domain>)`.

### Wildcard option

If you control `*.orija.store` on the tunnel:

```
Public hostname:  *.orija.store
Service:          http://localhost:18100
```

Still create DNS records (or Cloudflare proxied CNAME) per site. Traefik Host rules must match exactly.

## Manual Portainer UI deploy — platform

1. Stacks → Add stack → name `wp-platform`
2. Repository method → this GitHub repo + compose path `wordpress/platform/compose.yml`
3. Env from `wordpress/platform/.env.example`
4. Deploy → verify network `wp-public`

## Manual Portainer UI deploy — site

1. Run `new-site.sh` so compose + `.env` exist
2. Stacks → Add stack → name `wp-<slug>`
3. Web editor → paste compose contents
4. Environment variables → paste each key from `.env`
5. Access control → assign to the account’s Portainer user/team
6. Deploy

## API deploy scripts

```bash
export PORTAINER_URL=https://portainer.orija.store
export PORTAINER_API_TOKEN=ptr_...

./wordpress/scripts/deploy-platform.sh
./wordpress/scripts/deploy-site.sh --slug acme
```

`deploy-platform.sh` uses **create/redeploy from git**.  
`deploy-site.sh` uses **create/update from string** so secrets stay local.

## Git redeploy of platform after merges

```bash
BRANCH=refs/heads/main ./wordpress/scripts/deploy-platform.sh
```

Or Portainer → `wp-platform` → Pull and redeploy.

## Access control tips

- Admin token can manage all stacks — use for automation
- Standard users should only receive access to their `wp-*` stacks
- Do not grant standard users access to `wp-platform` unless they operate the edge proxy

## Related skill

Cloud Agents can follow `.cursor/skills/portainer-deploy/SKILL.md` for general Portainer API patterns on this host. WordPress-specific paths and ports are documented in this folder.
