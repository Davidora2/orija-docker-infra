---
name: portainer-deploy
description: Deploy and update Docker Compose stacks on Portainer via the HTTP API (create, git redeploy, logs, health checks). Use when the user mentions Portainer, portainer.orija.store, deploying a stack, Edge Agent, Cloudflare Tunnel origins, or asks another agent to build/ship on the orija Docker host.
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
| Life OS stack | `life-os` |
| Life OS origin port | `18088` → Caddy `:80` |
| Life OS domain | `lifeos.orija.store` |
| Tunnel service | `http://localhost:18088` |
| Compose (tunnel) | `compose.portainer.yml` |
| Repo | `https://github.com/Davidora2/orija-docker-infra` |

Confirm endpoint id each run from `/api/endpoints` — do not hard-fail if it changes.

## Compose rules

1. Do **not** bind host `80`/`443`.
2. Publish HTTP on a free high port (Life OS: `18088:80`).
3. User maps Cloudflare Tunnel hostname → that origin.
4. Avoid `build:` in Portainer creates (Cloudflare **524**). Use image pull + git bootstrap, or registry images.
5. Prefer self-contained compose (inline commands/configs).

## Create stack

```bash
EP=3
APP_DOMAIN="${APP_DOMAIN:-lifeos.orija.store}"
BRANCH="${BRANCH:-refs/heads/cursor/life-os-planning-docs-c38b}"
POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -d '/+=' | head -c 40)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)

python3 - <<'PY'
import json, os
json.dump({
  "Name": os.environ.get("STACK_NAME", "life-os"),
  "RepositoryURL": "https://github.com/Davidora2/orija-docker-infra",
  "RepositoryReferenceName": os.environ["BRANCH"],
  "ComposeFile": "compose.portainer.yml",
  "RepositoryAuthentication": False,
  "Env": [
    {"name": "LIFE_OS_DOMAIN", "value": os.environ["APP_DOMAIN"]},
    {"name": "POSTGRES_PASSWORD", "value": os.environ["POSTGRES_PASSWORD"]},
    {"name": "JWT_SECRET", "value": os.environ["JWT_SECRET"]},
  ],
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
| 524 on create | Remove Docker `build:`; bootstrap at runtime |
| Port allocated | Choose another high port; update tunnel |
| Mount not a directory | Inline config; avoid AdditionalFiles |
| Empty containers list | Normal for non-admin token |
| Public URL down | Tunnel/DNS; check origin port |

Agents testing Life OS on production (`lifeos.orija.store`) must **never** register accounts with disposable domains (`@orija.store`, `@example.com`, `@lifeos-audit.local`) or agent-style local parts (`audit-ui-*`, `dark-heroes-*`). Registration and outbound auth mail are blocked for those patterns.

- Token lives only in Cursor secrets / shell env
- Never write `ptr_…` into git, SKILL.md, or PR text
- Prefer short-lived tokens; revoke when compromised
