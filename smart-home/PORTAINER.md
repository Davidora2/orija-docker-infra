# Deploy HomePulse on Portainer (+ Cloudflare Tunnel)

## Stack file

Use [`portainer-stack.yml`](./portainer-stack.yml) (image pull + git bootstrap, no `build:`).

## Portainer UI

1. **Stacks → Add stack** → name `homepulse`
2. Paste contents of `portainer-stack.yml`
3. Add env vars (generate your own secrets):

| Name | Example |
|------|---------|
| `GATEWAY_PORT` | `18091` |
| `POSTGRES_PASSWORD` | strong random |
| `API_KEY_PEPPER` | strong random |
| `BOOTSTRAP_ADMIN_TOKEN` | strong random |
| `GIT_TOKEN` | **required** — GitHub PAT / fine-grained token with `contents:read` on this private repo |
| `FCM_MODE` | `dry_run` (or `firebase`) |
| `HOMEPULSE_REPO_REF` | `refs/heads/cursor/ring-google-notify-272e` |

Without `GIT_TOKEN`, containers cannot clone the private repo and `home-registry` will stay unhealthy.


4. Deploy. Gateway publishes **host port 18091**.

## Cloudflare Tunnel (you configure)

Point a public hostname at the Portainer host origin:

```text
https://homepulse.YOUR_DOMAIN  →  http://localhost:18091
```

Same pattern as `lifeos.orija.store` → `localhost:18088`.

Do **not** publish 80/443 on the Docker host; terminate TLS on Cloudflare.

## After deploy

```bash
# Health
curl https://homepulse.YOUR_DOMAIN/health

# Bootstrap demo home + simulate ding
export GATEWAY=https://homepulse.YOUR_DOMAIN
export BOOTSTRAP_ADMIN_TOKEN=...   # same as stack env
./scripts/bootstrap_demo.sh
```

## MQTT

Mosquitto stays on the internal `homepulse` Docker network (not published). Run Zigbee2MQTT / Frigate on the same Docker host network or attach them to `homepulse` if they need the broker.
