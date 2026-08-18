---
name: portainer-deploy
description: Deploy and update Docker Compose stacks on Portainer via the HTTP API (create, git redeploy, logs, health checks). Use when the user mentions Portainer, portainer.orija.store, deploying a stack, Edge Agent, Cloudflare Tunnel origins, WordPress hosting stacks (wp-platform / wp-*), or asks another agent to build/ship on the orija Docker host.
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
| Endpoint id | `3` |
| Docker host | `odserver2` |
| Token user | non-admin `cursor` (only sees own stacks) |
| Repo | `https://github.com/Davidora2/orija-docker-infra` |

Confirm endpoint id each run from `/api/endpoints` — do not hard-fail if it changes.

## Compose rules

1. Do **not** bind host `80`/`443`.
2. Publish HTTP on a free high port; Cloudflare Tunnel maps hostname → that origin.
3. Avoid `build:` in Portainer creates (Cloudflare **524**). Use public images.
4. Prefer self-contained compose (inline commands/configs).

## WordPress hosting (preferred path)

Use the scripts under `wordpress-hosting/scripts/` instead of hand-rolling API calls:

```bash
cd wordpress-hosting
./scripts/deploy-platform.sh                 # once per host (Redis + network)
./scripts/provision-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --title "Acme" \
  --admin-user acmeadmin \
  --deploy
./scripts/list-sites.sh --portainer
```

| Stack | Compose path |
|-------|----------------|
| `wp-platform` | `wordpress-hosting/platform/docker-compose.yml` |
| `wp-<slug>` | `wordpress-hosting/templates/wordpress-site/docker-compose.yml` |

Docs: `wordpress-hosting/README.md` and `wordpress-hosting/docs/`.

## Create stack (generic git)

```bash
EP=3
BRANCH="${BRANCH:-refs/heads/main}"

python3 - <<'PY'
import json, os
json.dump({
  "Name": os.environ.get("STACK_NAME", "my-stack"),
  "RepositoryURL": "https://github.com/Davidora2/orija-docker-infra",
  "RepositoryReferenceName": os.environ["BRANCH"],
  "ComposeFile": os.environ.get("COMPOSE_FILE", "compose.portainer.yml"),
  "RepositoryAuthentication": False,
  "Env": [],
}, open("/tmp/stack-create.json", "w"))
PY

curl -fsS --max-time 180 "${AUTH[@]}" -H "Content-Type: application/json" \
  --data-binary @/tmp/stack-create.json \
  -X POST "$PORTAINER_URL/api/stacks/create/standalone/repository?endpointId=$EP"
```

Private repo: set `RepositoryAuthentication` + GitHub deploy PAT (separate from Portainer token).

## Redeploy

```bash
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/stacks"   # find Id
# PUT /api/stacks/{id}/git/redeploy?endpointId=$EP
# Body: PullImage, RepositoryReferenceName, Env (reuse existing secrets)
```

See [reference.md](reference.md) for full payloads and log decoding.

## Failure playbook

| Symptom | Fix |
|---------|-----|
| 524 on create | Remove Docker `build:`; use public images |
| Port allocated | Choose another high port; update tunnel |
| `wp-platform` network missing | `./scripts/deploy-platform.sh` first |
| Empty containers list | Normal for non-admin token |
| Public URL down | Tunnel/DNS; check origin port |

## Security

- Token lives only in Cursor secrets / shell env
- Never write `ptr_…` into git, SKILL.md, or PR text
- Prefer short-lived tokens; revoke when compromised
- WordPress passwords stay in Portainer env / `sites/<slug>/.env` (gitignored)
