# HomePulse

Dockerized smart-home notification platform: **Ring doorbell ring → Google phone push (FCM)**.

Built as a small set of microservices on an event bus so you can grow into a secure, multi-device smart home without rewriting the core path.

## Quick start

```bash
cd smart-home
cp .env.example .env
docker compose up --build -d
chmod +x scripts/bootstrap_demo.sh
./scripts/bootstrap_demo.sh
docker compose logs -f notifier
```

You should see a `DRY-RUN FCM → ...` log line with title **Doorbell** when the simulated ding flows through.

Gateway: [http://localhost:8080/health](http://localhost:8080/health)

## What you get

| Piece | Purpose |
|-------|---------|
| `gateway` | Public API edge + rate limits |
| `home-registry` | Homes, Ring devices, users, FCM tokens, API keys |
| `ring-ingest` | Ring webhook + simulator → normalized events |
| `rules-engine` | `doorbell.ring` → `notify.push` |
| `notifier` | Firebase Cloud Messaging (or dry-run) |
| `postgres` / `redis` | State + event streams |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the scale / security design.

## Wire a real Ring doorbell

1. Bootstrap a home and register your Ring device `external_id` (from your Ring bridge).
2. Point your bridge (**ring-mqtt**, automation tool, etc.) at:

```http
POST http://<host>:8080/v1/webhooks/ring
X-API-Key: <home api key>
Content-Type: application/json

{
  "device_id": "ring-front-door-001",
  "event": "ding",
  "kind": "ding",
  "snapshot_url": "https://optional/snapshot.jpg"
}
```

3. Optional: set `RING_WEBHOOK_SECRET` and send the same value in `X-Webhook-Secret`.

## Wire Google phone notifications

1. Create a Firebase project and enable **Cloud Messaging**.
2. Download a service-account JSON to `smart-home/secrets/firebase-service-account.json`.
3. In `.env`:

```env
FCM_MODE=firebase
FCM_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase-service-account.json
```

4. From your Android app, obtain an FCM registration token and register it:

```bash
curl -X POST http://localhost:8080/v1/push-tokens \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_email":"you@example.com","token":"<fcm-token>","platform":"android"}'
```

5. Restart notifier: `docker compose up -d notifier`.

## Demo without hardware

```bash
./scripts/bootstrap_demo.sh
# or
curl -X POST http://localhost:8080/v1/simulate/ring \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"external_device_id":"ring-front-door-001","event":"ding"}'
```

## Tests

```bash
cd smart-home
pip install -e ./shared pytest
pytest -q
```

## Project layout

```
smart-home/
  docker-compose.yml
  ARCHITECTURE.md
  config/nginx/
  services/
    home-registry/
    ring-ingest/
    rules-engine/
    notifier/
  shared/homepulse/     # event contracts + stream helpers
  scripts/bootstrap_demo.sh
  tests/
```
