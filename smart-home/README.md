# HomePulse

Dockerized smart-home platform: **Ring/ESP doorbell → Google phone (FCM)** plus security automations (porch light, Frigate snapshots/clips, away siren, armed sensors, sunset auto-lock).

## Quick start

```bash
cd smart-home
cp .env.example .env
docker compose up --build -d
chmod +x scripts/bootstrap_demo.sh
./scripts/bootstrap_demo.sh
docker compose logs -f notifier mqtt-commander rules-engine
```

Gateway: http://localhost:8080/health · MQTT: localhost:1883

## Automations included

See [AUTOMATIONS.md](./AUTOMATIONS.md) for the full matrix. Highlights:

- Ding → FCM push (+ Frigate snapshot URL)
- Ding → porch light on for N minutes (MQTT / Zigbee2MQTT)
- Ding while **away** → critical push + siren/chime
- Door/window open while **armed** → push + siren
- Lock still unlocked after sunset → reminder + auto-lock
- Frigate **person** detection → push with clip link

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — scale & security design
- [AUTOMATIONS.md](./AUTOMATIONS.md) — rules, roles, OSS wiring

## Tests

```bash
pip install -e ./shared pytest httpx
PYTHONPATH=shared:services/rules-engine pytest -q
```
