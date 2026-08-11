---
name: portainer-deploy
description: Deploy and update Docker Compose stacks on Portainer via the HTTP API (create, git redeploy, logs, health checks). Use when the user mentions Portainer, portainer.orija.store, deploying a stack, Edge Agent, Cloudflare Tunnel origins, or asks another agent to build/ship on the orija Docker host.
---

# Portainer Deploy

Deploy and update stacks on the orija Portainer instance using the **API access token** path (preferred over admin password or SSH).

## When to use

- User asks to deploy, redeploy, or update a stack on Portainer
- User provides a Portainer URL + API token
- Shipping apps behind an existing Cloudflare Tunnel (do not bind host 80/443)

## Required inputs (never invent)

Collect before mutating anything:

| Input | Notes |
|-------|--------|
| `PORTAINER_URL` | e.g. `https://portainer.orija.store` |
| `PORTAINER_TOKEN` | Access token (`ptr_…`). Prefer env secret `PORTAINER_TOKEN` when set; otherwise ask the user. Store only in shell env / `/tmp`, **never commit** |
| App domain | Public hostname (e.g. `lifeos.orija.store`) — **not** the Portainer hostname |
| Compose file | Usually `compose.portainer.yml` for tunnel hosts |
| Git ref | Branch/tag that contains the compose file |

If any are missing, stop and ask. Do not reuse expired tokens from chat history without confirmation.

## Auth header

```bash
export PORTAINER_URL='https://portainer.orija.store'
# Prefer Cloud Agent secret when present
export PORTAINER_TOKEN="${PORTAINER_TOKEN:-}"
if [ -z "$PORTAINER_TOKEN" ] && [ -f /tmp/portainer-token ]; then
  PORTAINER_TOKEN=$(cat /tmp/portainer-token)
fi
# If still empty, ask the user for a fresh ptr_… token (do not invent one)
AUTH=(-H "X-API-Key: $PORTAINER_TOKEN")
```

Verify:

```bash
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/status"
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/users/me"
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/endpoints"
```

Known production endpoint (confirm each run):

- Name: `local`
- Id: `3` (Type 1 = Docker local socket)
- Host: `odserver2`

Standard users only see **their own** stacks/containers. Prefer a limited `cursor` (or deploy) user token, not admin.

## Compose rules for this host

Portainer sits behind Cloudflare; the Docker host already uses 80/443 elsewhere.

1. **Do not** publish `80:80` / `443:443` on new stacks.
2. Use an HTTP-only reverse proxy on a free high port (Life OS uses **`18088:80`**).
3. User points Cloudflare Tunnel → `http://localhost:<port>` (or `http://172.17.0.1:<port>` / Docker network service).
4. Avoid long `docker build` during `stack create` — Cloudflare often **524**s (~100s). Prefer:
   - pull public images + bootstrap from git at container start, **or**
   - prebuilt registry images
5. Prefer **self-contained compose** (inline entrypoint/Caddyfile) so Portainer git deploy does not depend on `AdditionalFiles` bind mounts.

Repo defaults:

- Tunnel stack: `compose.portainer.yml`
- Direct HTTPS stack: `compose.production.yml` (only if ports 80/443 are free)

## Create stack (git repository)

```bash
EP=3   # from /api/endpoints
BRANCH='refs/heads/<branch-with-compose>'

# Generate secrets once; keep in /tmp only
POSTGRES_PASSWORD=$(openssl rand -base64 36 | tr -d '/+=' | head -c 40)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)

python3 - <<'PY'
import json, os
json.dump({
  "Name": "life-os",  # or stack name for the app
  "RepositoryURL": "https://github.com/Davidora2/orija-docker-infra",
  "RepositoryReferenceName": os.environ["BRANCH"],
  "ComposeFile": "compose.portainer.yml",
  "RepositoryAuthentication": False,  # True + username/password if repo private
  "Env": [
    {"name": "LIFE_OS_DOMAIN", "value": os.environ["APP_DOMAIN"]},
    {"name": "POSTGRES_PASSWORD", "value": os.environ["POSTGRES_PASSWORD"]},
    {"name": "JWT_SECRET", "value": os.environ["JWT_SECRET"]},
  ],
}, open("/tmp/stack-create.json", "w"))
PY

curl -fsS --max-time 180 "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/stack-create.json \
  -X POST "$PORTAINER_URL/api/stacks/create/standalone/repository?endpointId=$EP"
```

Private GitHub repos: set `RepositoryAuthentication: true` and pass a deploy PAT (not the Portainer token).

## Redeploy / update existing stack

List stacks → get `Id`:

```bash
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/stacks"
```

Git redeploy (pulls new commit on same branch):

```bash
STACK_ID=<id>
curl -fsS --max-time 300 "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -X PUT "$PORTAINER_URL/api/stacks/$STACK_ID/git/redeploy?endpointId=$EP" \
  --data-binary @/tmp/stack-redeploy.json
```

`/tmp/stack-redeploy.json` shape:

```json
{
  "PullImage": false,
  "RepositoryAuthentication": false,
  "RepositoryReferenceName": "refs/heads/<branch>",
  "Env": [ { "name": "LIFE_OS_DOMAIN", "value": "…" }, … ]
}
```

Reuse existing env secrets from the stack payload when updating; do not rotate DB passwords casually.

## Inspect & verify

```bash
# Containers visible to this token
curl -fsS "${AUTH[@]}" "$PORTAINER_URL/api/endpoints/$EP/docker/containers/json?all=true"

# One-shot health from inside the stack network
# (create a short-lived curl container on network life-os → http://caddy/api/health)

# Public check after tunnel hostname is live
curl -fsS "https://<APP_DOMAIN>/api/health"
```

Logs (docker multiplexed stream — strip 8-byte headers when printing):

```bash
curl -fsS "${AUTH[@]}" \
  "$PORTAINER_URL/api/endpoints/$EP/docker/containers/<id>/logs?stdout=true&stderr=true&tail=80"
```

## Failure playbook

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| HTTP 524 on create | Build too slow via Cloudflare | No `build:` in Portainer compose; bootstrap or prebuild images |
| `port is already allocated` | Chosen host port taken | Pick another high port; update tunnel origin |
| Mount “not a directory” | Missing AdditionalFiles became a dir | Inline config in compose `command:` |
| Empty container list | Non-admin token | Expected; only own resources visible |
| Clone fails in container | Private repo | Auth on git clone / Portainer RepositoryAuthentication |
| Health OK internally, public fail | Tunnel/DNS | User must map hostname → origin port |

## Security

- Prefer non-admin Portainer user + short-lived access token
- Never commit tokens, DB passwords, or JWT secrets
- Remind user to **revoke** the token after the deploy session
- Do not expose Postgres ports publicly

## After deploy (tell the user)

1. Cloudflare Tunnel public hostname → `http://localhost:<published-port>`
2. Confirm `https://<APP_DOMAIN>/…` health
3. Point mobile/web clients at `https://<APP_DOMAIN>/api` if applicable
4. Revoke Portainer token when done

## More detail

- API payloads and curl recipes: [reference.md](reference.md)
