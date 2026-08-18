# Portainer API reference (orija)

Base: `https://portainer.orija.store/api`  
Auth: header `X-API-Key: $PORTAINER_API_TOKEN` (Cloud Agent secret)

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
| PUT | `/stacks/{id}?endpointId=` | Update string stack |
| GET | `/endpoints/{id}/docker/containers/json?all=true` | List containers |
| GET | `/endpoints/{id}/docker/containers/{cid}/logs` | Logs |

## Create-from-git body

```json
{
  "Name": "wp-platform",
  "RepositoryURL": "https://github.com/Davidora2/orija-docker-infra",
  "RepositoryReferenceName": "refs/heads/main",
  "ComposeFile": "wordpress/platform/compose.yml",
  "RepositoryAuthentication": false,
  "Env": [
    { "name": "PLATFORM_HTTP_PORT", "value": "18100" }
  ]
}
```

## Create-from-string body (WordPress sites)

```json
{
  "Name": "wp-acme",
  "StackFileContent": "<compose yaml>",
  "Env": [
    { "name": "MYSQL_PASSWORD", "value": "..." }
  ]
}
```

## Redeploy body

```json
{
  "PullImage": true,
  "RepositoryAuthentication": false,
  "RepositoryReferenceName": "refs/heads/main",
  "Env": []
}
```

## WordPress platform

| Field | Value |
|-------|--------|
| Stack | `wp-platform` |
| Origin | `18100→80` |
| Dashboard | `18101` (private) |
| Network | `wp-public` |
| Tunnel | site hostnames → `http://localhost:18100` |

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

## Secret setup (for humans)

1. Cursor Environment → Secrets → add `PORTAINER_API_TOKEN`
2. Value = Portainer access token (`ptr_…`) from Portainer → My account → Access tokens
3. Agents read it as `$PORTAINER_API_TOKEN` — never paste into the repo
