# Orija Docker Infra

Dockerized services for Orija commerce automation.

## Services

| Service | Path | Purpose |
|---------|------|---------|
| **Pinterest Pin Agent** | `services/pinterest-pin-agent/` | Score Shopify products vs keywords, create 2:3 pins + captions, post to Pinterest on a schedule |

## Start here

1. Read **[WHAT_I_NEED_FROM_YOU.md](./WHAT_I_NEED_FROM_YOU.md)** — credentials checklist
2. Configure `services/pinterest-pin-agent/.env` from `.env.example`
3. Edit `services/pinterest-pin-agent/config/keywords.yaml` and `brand.yaml`
4. `docker compose up -d --build`

Default mode is **dry_run** (drafts only, no public posts).
