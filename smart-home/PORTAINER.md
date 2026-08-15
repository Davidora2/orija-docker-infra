# Deploy HomePulse on Portainer (+ Cloudflare Tunnel)

## Stack file

[`portainer-stack.yml`](./portainer-stack.yml) is **self-contained**:

- No git clone at runtime (git is for version control only)
- App source is embedded as a base64 tarball and extracted by the `seed` service

Regenerate after code changes:

```bash
python3 smart-home/scripts/generate_portainer_stack.py
```

## Portainer UI

1. **Stacks → Add stack** → name `homepulse`
2. Paste contents of `portainer-stack.yml`
3. Env vars:

| Name | Required | Notes |
|------|----------|--------|
| `POSTGRES_PASSWORD` | yes | strong random |
| `API_KEY_PEPPER` | yes | strong random |
| `BOOTSTRAP_ADMIN_TOKEN` | yes | used by bootstrap script |
| `GATEWAY_PORT` | no | default `18091` |
| `FCM_MODE` | no | `dry_run` or `firebase` |

4. Deploy. Gateway publishes **host port 18091**.

## Cloudflare Tunnel (you configure)

```text
https://homepulse.YOUR_DOMAIN  →  http://localhost:18091
```

Same pattern as life-os → `localhost:18088`. Terminate TLS on Cloudflare; do not publish 80/443 on the Docker host.

## Firebase (Google phone push)

Project ID: `home-pulse-99808` (Android package `home.pulse`).

1. Register FCM device token in Admin → **Phone push tokens**
2. Put Firebase **service account** JSON in volume `homepulse_homepulse-secrets` as `firebase-service-account.json`
3. Stack env:

| Name | Value |
|------|--------|
| `FCM_MODE` | `firebase` |
| `FCM_PROJECT_ID` | `home-pulse-99808` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `/secrets/firebase-service-account.json` |

Details: [`docs/FIREBASE.md`](./docs/FIREBASE.md)
