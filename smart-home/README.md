# Haven Smart Home — scalable doorbell → Google phone notifications

Dockerized event-driven platform: **Ring doorbell rings → MQTT event bus → automation rules → Firebase Cloud Messaging (Google phone)**.

Designed so you can grow from one doorbell into a full secure smart-home system (cameras, locks, sensors, more notification channels) without rewriting the core.

## Architecture

```
┌─────────────┐   ding    ┌──────────────┐  doorbell.rung  ┌──────────────────┐
│ Ring Bridge │ ────────► │ MQTT broker  │ ──────────────► │ Event Processor  │
│ (or mock)   │           │ (Mosquitto)  │                 │ (rules engine)   │
└─────────────┘           └──────────────┘                 └────────┬─────────┘
                              ▲                                     │ notify/request
                              │                                     ▼
┌─────────────┐           ┌───┴──────────┐                 ┌──────────────────┐
│ API Gateway │ ◄──────── │  Postgres    │ ◄────────────── │ Notification GW  │
│ + Dashboard │   audit   │  event log   │   delivery log  │ FCM / Nest hook  │
└─────────────┘           └──────────────┘                 └──────────────────┘
```

| Service | Role | Scale path |
|---------|------|------------|
| `ring-bridge` | Ingest Ring (or mock) doorbell presses | Add `nest-bridge`, `zwave-bridge`, … |
| `mosquitto` | Auth’d MQTT event bus | Cluster / TLS listener 8883 |
| `event-processor` | Home automation rules | Horizontal replicas; rules in DB |
| `notification-gateway` | FCM + Google Home webhook + console | Add SMS, email, Matter |
| `api-gateway` | API keys, rate limits, Helmet | JWT/OIDC, mTLS later |
| `postgres` | Devices, rules, audit logs | Read replicas |
| `redis` | Reserved for sessions / rate-limit store | Cluster mode |
| `dashboard` | Demo UI (“Haven”) | Optional in production |

## Quick start (mock Ring → console notifications)

```bash
cd smart-home
cp .env.example .env
mkdir -p secrets
docker compose up --build -d
```

Open **http://localhost:8080** and click **Ring doorbell**.

Within ~1–2 seconds you should see:

1. A `doorbell.rung` event in **Live activity**
2. Notification rows (`console` = sent; `fcm` / `google_home_broadcast` = skipped until configured)

API (same flow):

```bash
curl -s -X POST http://localhost:3100/v1/doorbell/ring \
  -H "x-api-key: sh_demo_key_change_me" \
  -H "content-type: application/json" \
  -d '{"actor":"curl"}'
```

## Connect a real Ring doorbell

1. Obtain a Ring refresh token (see [ring-client-api](https://github.com/dgreif/ring) auth docs).
2. In `.env`:

```env
MOCK_MODE=false
RING_REFRESH_TOKEN=your_refresh_token
```

3. `docker compose up -d --build ring-bridge`

The bridge subscribes to `onDoorbellPressed` and publishes the same `doorbell.rung` events as mock mode.

## Send notifications to a Google / Android phone (FCM)

1. Create a Firebase project and enable **Cloud Messaging**.
2. Create a service account JSON → save as `smart-home/secrets/fcm-service-account.json`.
3. Install your companion app (or any FCM-capable client) and copy the device registration token.
4. Set in `.env`:

```env
FCM_PROJECT_ID=your-firebase-project-id
FCM_DEVICE_TOKEN=device_fcm_token_here
GOOGLE_APPLICATION_CREDENTIALS=/secrets/fcm-service-account.json
```

5. Restart: `docker compose up -d notification-gateway`

When FCM is not configured, the gateway still logs notifications and records `skipped` with a clear reason — so demos work offline.

### Optional: announce on Google Nest / Home

Point `GOOGLE_HOME_WEBHOOK_URL` at Home Assistant TTS, a Cast webhook, or your own Nest speaker bridge. The gateway POSTs `{ "message": "Doorbell. Someone is at Front Door Ring" }`.

## Security model (baseline → production)

Already included:

- MQTT username/password (anonymous disabled)
- API keys hashed at rest (SHA-256), scoped (`read` / `write` / `admin`)
- Helmet + CORS + rate limiting on the API gateway
- Isolated Docker network; only API + dashboard ports published
- Secrets via env / bind-mounted credential files (not in images)

Scale-up checklist:

1. Rotate `DEMO_API_KEY`, MQTT, and Postgres passwords
2. Terminate TLS at a reverse proxy (Caddy/Traefik) for `:8080` / `:3100`
3. Enable Mosquitto TLS (`listener 8883`) and certificates under `infra/mosquitto`
4. Replace demo API keys with OIDC / per-device mTLS
5. Run services as non-root, add resource limits, and ship logs to a SIEM
6. Multi-home: one `homes` row per residence; MQTT topics are already `home/{homeId}/…`

## Event contracts

Shared package: `packages/shared`.

- Device event topic: `home/{homeId}/device/{deviceId}/event/{type}`
- Notify request: `home/{homeId}/notify/request`
- Notify result: `home/{homeId}/notify/result`

Example `doorbell.rung` payload:

```json
{
  "id": "…",
  "homeId": "11111111-1111-1111-1111-111111111111",
  "deviceId": "ring-doorbell-1",
  "deviceType": "doorbell",
  "type": "doorbell.rung",
  "source": "mock",
  "occurredAt": "2026-08-15T12:00:00.000Z",
  "payload": { "name": "Front Door Ring" }
}
```

## Project layout

```
smart-home/
  docker-compose.yml
  packages/shared/          # MQTT topics + event helpers
  services/
    ring-bridge/
    event-processor/
    notification-gateway/
    api-gateway/
    dashboard/
  infra/
    mosquitto/
    postgres/
  secrets/                  # FCM JSON (gitignored)
```

## Health checks

```bash
docker compose ps
curl -s http://localhost:3100/health
curl -s http://localhost:8080/health
```
