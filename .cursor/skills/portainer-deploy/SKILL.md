---
name: portainer-deploy
description: Deploy and update Docker Compose stacks on Portainer via the HTTP API (create, git redeploy, logs, health checks). Use when the user mentions Portainer, portainer.orija.store, deploying a stack, Edge Agent, Cloudflare Tunnel origins, WordPress hosting, wp-platform, or asks another agent to build/ship on the orija Docker host.
---

# Portainer Deploy

Deploy and update stacks on **https://portainer.orija.store** with an API access token (never admin password).

## Credentials (required)

| Name | Source |
|------|--------|
| `PORTAINER_API_TOKEN` | Cloud Agent / environment **secret** (same `ptr_…` token). Never commit. |
| `PORTAINER_URL` | Default `https://portainer.orija.store` |

Load token:

```bash
export PORTAINER_URL="${PORTAINER_URL:-https://portainer.orija.store}"
export PORTAINER_API_TOKEN="${PORTAINER_API_TOKEN:-${PORTAINER_TOKEN:-}}"
if [ -z "$PORTAINER_API_TOKEN" ]; then
  echo "Missing PORTAINER_API_TOKEN secret. Ask the user to add it in Environment secrets."
  exit 1
fi
AUTH=(-H "X-API-Key: $PORTAINER_API_TOKEN")
```

Verify before mutating:

```bash
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/status"
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/users/me"
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/endpoints"
```

## Known host defaults

| Item | Value |
|------|--------|
| Endpoint name | `local` |
| Endpoint id | `3` (confirm each run) |
| Docker host | `odserver2` |
| Token user | non-admin `cursor` (only sees own stacks) |
| Repo | `https://github.com/Davidora2/orija-docker-infra` |

## Compose rules

1. Do **not** bind host `80`/`443`.
2. Publish HTTP on a free high port.
3. User maps Cloudflare Tunnel hostname → that origin.
4. Avoid `build:` in Portainer creates (Cloudflare **524**). Use image pull only.
5. Prefer self-contained compose (inline commands/configs).

## WordPress hosting (multi-site)

Platform stack (once per host):

| Item | Value |
|------|--------|
| Stack | `wp-platform` |
| Compose | `wordpress/platform/compose.yml` |
| Origin port | `18100→80` (Traefik) |
| Dashboard port | `18101` (private) |
| Network | `wp-public` |
| Scripts | `wordpress/scripts/deploy-platform.sh` |

Each website:

| Item | Value |
|------|--------|
| Stack | `wp-<slug>` |
| Compose | `wordpress/sites/<slug>/compose.yml` (generated) |
| Tunnel | `<domain>` → `http://localhost:18100` |
| Provision | `wordpress/scripts/new-site.sh` |
| Deploy | `wordpress/scripts/deploy-site.sh --slug <slug>` |

Docs: `wordpress/README.md`, `wordpress/docs/`.

## Create stack (git)

```bash
EP=3
BRANCH="${BRANCH:-refs/heads/main}"

python3 - <<'PY'
import json, os
json.dump({
  "Name": os.environ.get("STACK_NAME", "wp-platform"),
  "RepositoryURL": "https://github.com/Davidora2/orija-docker-infra",
  "RepositoryReferenceName": os.environ["BRANCH"],
  "ComposeFile": os.environ.get("COMPOSE_FILE", "wordpress/platform/compose.yml"),
  "RepositoryAuthentication": False,
  "Env": [
    {"name": "PLATFORM_HTTP_PORT", "value": "18100"},
    {"name": "PLATFORM_DASHBOARD_PORT", "value": "18101"},
  ],
}, open("/tmp/stack-create.json", "w"))
PY

curl -fsS --max-time 180 "${AUTH[@]}" -H "Content-Type: application/json" \
  --data-binary @/tmp/stack-create.json \
  -X POST "$PORTAINER_URL/api/stacks/create/standalone/repository?endpointId=$EP"
```

## Redeploy

```bash
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/stacks"   # find Id
# PUT /api/stacks/{id}/git/redeploy?endpointId=$EP
```

See [reference.md](reference.md) for payloads and log decoding.

## Failure playbook

| Symptom | Fix |
|---------|-------|
| 524 on create | Remove Docker `build:`; use Hub images |
| Port allocated | Choose another high port; update tunnel |
| Empty containers list | Normal for non-admin token |
| WP site 404 | Platform down or Host/tunnel mismatch |
| Site deploy fails on network | Deploy `wp-platform` first (`wp-public`) |

## Security

- Token lives only in Cursor secrets / shell env
- Never write `ptr_…` into git, SKILL.md, or PR text
- Site DB passwords stay in Portainer env / local `.env` (gitignored)
