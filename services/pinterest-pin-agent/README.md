# Pinterest × Shopify Pin Agent

Automated agent that:

1. Pulls active products (and images) from Shopify
2. Scores them against your keyword / seasonal trend config
3. Writes searchable pin titles + captions
4. Formats images to Pinterest’s preferred **1000×1500 (2:3)** canvas
5. Posts on a schedule (~**1 pin every 2 hours** by default)

Starts in **`dry_run`** mode so nothing is published until you flip to `live`.

## Quick start

```bash
cp services/pinterest-pin-agent/.env.example services/pinterest-pin-agent/.env
# edit .env + config/keywords.yaml + config/brand.yaml

docker compose build
docker compose up -d pinterest-pin-agent
docker compose logs -f pinterest-pin-agent
```

Single cycle (no scheduler):

```bash
docker compose run --rm pinterest-pin-agent python -m pin_agent once
```

## What you need to provide

See **[WHAT_I_NEED_FROM_YOU.md](./WHAT_I_NEED_FROM_YOU.md)** for the credential checklist.

Minimum to go live:

| Item | Where |
|------|--------|
| Shopify Admin API token (`read_products`) | `.env` |
| Shopify shop domain | `.env` |
| Pinterest app id/secret + OAuth tokens | `.env` (use `scripts/oauth_pinterest.py`) |
| Pinterest board id | `.env` |
| Seed keywords + brand voice | `config/keywords.yaml`, `config/brand.yaml` |
| Public product URL base (storefront) | `config/brand.yaml` → `website` |

## Layout

```
services/pinterest-pin-agent/
  src/pin_agent/     # agent code
  config/            # keywords + brand settings
  scripts/           # Pinterest OAuth helper
  .env.example
docker-compose.yml
```

## Safety defaults

- `PIN_AGENT_MODE=dry_run` — writes drafts under `/data/drafts` only
- Repost cooldown (default 30 days) per product image
- Optional quiet hours so pins are not posted overnight
- Token refresh persisted to `/data/state.json`
