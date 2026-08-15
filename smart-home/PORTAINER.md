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
| `VAPID_PUBLIC_KEY` | for iPhone join links | Web Push public key (see below) |

4. Deploy. Gateway publishes **host port 18091**.

## Family invites (no App Store — especially iPhone)

1. Admin → **Invite family** → **Create invite link**
2. Text/email the link (or open `https://homepulse.YOUR_DOMAIN/join/?code=…`)
3. On **iPhone**: Safari → Share → **Add to Home Screen** → open the HomePulse icon → **Enable alerts**
4. On **Android**: open the link in Chrome → **Enable alerts** → Allow
5. Tap **Open cameras & devices** for the home app (`/app/`) — live cameras + device controls

Requires HTTPS (Cloudflare Tunnel) and Web Push VAPID keys:

1. Generate keys once (keep private key off git):

```bash
python3 - <<'PY'
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64, json
priv = ec.generate_private_key(ec.SECP256R1())
pub = priv.public_key().public_bytes(
    serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
)
public_key = base64.urlsafe_b64encode(pub).decode().rstrip("=")
pem = priv.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()
print(json.dumps({"publicKey": public_key, "privateKeyPem": pem}, indent=2))
PY
```

2. Copy `privateKeyPem` into volume `homepulse_homepulse-secrets` as `vapid-private.pem`
3. Set stack env `VAPID_PUBLIC_KEY` to the `publicKey` value
4. Redeploy `home-registry` + `notifier` (or the whole stack)

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

## Cameras (14-day recordings)

Frigate runs inside the HomePulse stack. Activity footage is kept for **14 days**, then older segments are removed.

See [`docs/CAMERAS.md`](./docs/CAMERAS.md).

- Member app: `/app/`
- Admin: add device with **Preset: Camera**, set RTSP URL
- Volumes: `homepulse-frigate-media` (recordings), `homepulse-frigate-config`
