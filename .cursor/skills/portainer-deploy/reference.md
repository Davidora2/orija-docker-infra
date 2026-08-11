# Portainer API reference (orija)

Base: `https://portainer.orija.store/api`  
Auth: header `X-API-Key: ptr_…`

## Useful endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/status` | Version / connectivity |
| GET | `/users/me` | Token identity (`Role` 1=admin, 2=standard) |
| GET | `/endpoints` | Environments (`Id`, `Name`, `Type`, `Status`) |
| GET | `/stacks` | Stacks visible to token |
| POST | `/stacks/create/standalone/repository?endpointId=` | Create compose stack from git |
| POST | `/stacks/create/standalone/string?endpointId=` | Create from inline compose YAML |
| PUT | `/stacks/{id}/git/redeploy?endpointId=` | Pull git ref + recreate |
| GET | `/endpoints/{id}/docker/containers/json?all=true` | List containers |
| GET | `/endpoints/{id}/docker/containers/{cid}/logs` | Logs |
| POST | `/endpoints/{id}/docker/containers/create` | Ad-hoc container (healthchecks) |
| POST | `/endpoints/{id}/docker/containers/{cid}/start` | Start |
| DELETE | `/endpoints/{id}/docker/containers/{cid}?force=true` | Remove |

## Create-from-git body

```json
{
  "Name": "my-stack",
  "RepositoryURL": "https://github.com/org/repo",
  "RepositoryReferenceName": "refs/heads/main",
  "ComposeFile": "compose.portainer.yml",
  "RepositoryAuthentication": false,
  "Env": [
    { "name": "KEY", "value": "value" }
  ]
}
```

Optional: `"AdditionalFiles": ["deploy/Caddyfile"]` — fragile on Portainer; prefer inline config.

## Redeploy body

```json
{
  "PullImage": false,
  "RepositoryAuthentication": false,
  "RepositoryReferenceName": "refs/heads/main",
  "Env": []
}
```

Include full `Env` array; omitting vars can clear them depending on Portainer version.

## Life OS stack (current)

| Field | Value |
|-------|--------|
| Stack name | `life-os` |
| Endpoint | `local` id `3` |
| Compose | `compose.portainer.yml` |
| Published origin | `18088→80` (Caddy HTTP) |
| Public hostname | `lifeos.orija.store` |
| Tunnel service | `http://localhost:18088` |
| Health | `https://lifeos.orija.store/api/health` |
| Env | `LIFE_OS_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET` |

## Decode docker logs

```python
raw = open("logs.bin", "rb").read()
out, i = [], 0
while i + 8 <= len(raw):
    size = int.from_bytes(raw[i+4:i+8], "big")
    out.append(raw[i+8:i+8+size].decode("utf-8", "replace"))
    i += 8 + size
print("".join(out))
```

## Token setup (for humans)

1. Portainer → non-admin user with access to `local`
2. My account → Access tokens → create (`cursor-deploy`)
3. Paste token to the agent once; revoke after the session
