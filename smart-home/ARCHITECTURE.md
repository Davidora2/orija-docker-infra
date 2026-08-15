# Architecture — HomePulse Smart Home Platform

## Goal

When a **Ring doorbell** is rung, deliver a push notification to the homeowner’s **Google / Android phone** (Firebase Cloud Messaging), on an architecture that can grow into a full secure smart-home control plane.

## High-level flow

```
Ring Doorbell
    │  (webhook / ring-mqtt / IFTTT adapter)
    ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ API Gateway │────▶│ Ring Ingest  │────▶│ Redis Stream │────▶│ Rules      │
│ (nginx)     │     │ (normalize)  │     │ home.events  │     │ Engine     │
└─────────────┘     └──────┬───────┘     └──────────────┘     └─────┬──────┘
                           │                                        │
                           ▼                                        ▼
                    ┌──────────────┐                         ┌──────────────┐
                    │ Home Registry│◀── push targets ───────│ Notifier     │
                    │ (Postgres)   │                         │ (FCM / dry)  │
                    └──────────────┘                         └──────────────┘
                                                                    │
                                                                    ▼
                                                           Google phone (FCM)
```

## Services

| Service | Role | Scale notes |
|---------|------|-------------|
| **gateway** | TLS termination point (add certs in prod), rate limits, blocks `/v1/internal/*` | Horizontally scalable nginx/Envoy |
| **home-registry** | Homes, members, devices, hashed API keys, FCM tokens | Stateless app + Postgres |
| **ring-ingest** | Vendor adapter → normalized `DeviceEvent` | Stateless; add more vendor ingest services later |
| **rules-engine** | Event → `ActionCommand` (notify, device cmds, audit) | Redis consumer group → N replicas |
| **notifier** | Executes `notify.push` via FCM | Consumer group → N replicas |
| **postgres** | System of record | Managed Postgres / HA in prod |
| **redis** | Event bus (`home.events`, `home.actions`, `home.audit`) | Redis Cluster / MSK / NATS later |

## Security model (designed to harden over time)

1. **Home-scoped API keys** — hashed at rest with a server pepper; scopes like `ingest:write`.
2. **Bootstrap admin token** — only for provisioning; separate from device ingest keys.
3. **Optional Ring webhook secret** — edge shared-secret check before ingest.
4. **Network split** — Compose uses `edge` + `backend` networks; internal registry routes are not exposed on the gateway.
5. **Audit stream** — every ingest / rule / delivery is recorded on `home.audit` for forensics.
6. **Secrets** — Firebase service account mounted read-only from `./secrets` (gitignored).
7. **Rate limiting** — nginx zones on ingest and admin APIs.

### Production hardening roadmap

- mTLS between services (service mesh: Linkerd / Istio / Consul)
- External secrets (Vault / AWS SM / GCP SM) instead of `.env`
- Per-home JWT / OIDC for human users; short-lived device credentials
- WAF + TLS at the edge; private Link for registry
- Signed webhook payloads (HMAC over body + timestamp)
- PII minimization and retention policies on audit logs

## Scaling into a full smart home

The event schema already supports locks, cameras, sensors (`EventType`). Growth path:

1. Add `lock-ingest`, `camera-ingest`, `matter-bridge` services that publish the same `DeviceEvent` shape.
2. Persist rules in Postgres (per-home automations UI) — worker already uses a pluggable rule table.
3. Add action executors: `device-commander` (MQTT/Matter), `notify.sms`, `notify.google_home`.
4. Replace Redis Streams with NATS JetStream / Kafka when multi-region.
5. Multi-tenant control plane + local edge gateway for LAN devices (Matter/Thread).

## Ring integration options

Ring does not expose a simple official public “ding webhook” for all accounts. This platform supports:

1. **HTTP webhook** (`POST /v1/webhooks/ring`) — for bridges such as **ring-mqtt**, n8n, or custom adapters.
2. **Simulate API** (`POST /v1/simulate/ring`) — local demo without hardware.
3. Future: official OAuth poller service as another ingest publisher (same event contract).

## Google phone notifications

- Register each phone’s **FCM device token** via `POST /v1/push-tokens`.
- Set `FCM_MODE=firebase` and mount a Firebase service-account JSON to send real pushes.
- Default `FCM_MODE=dry_run` logs the exact notification payload for safe demos.
