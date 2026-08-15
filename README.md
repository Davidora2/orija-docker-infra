# Workspace

This repository contains:

1. **[smart-home/](./smart-home)** — **HomePulse**: Dockerized Ring doorbell → Google phone (FCM) notifications, designed to scale into a secure smart-home platform.
2. **[apps/web](./apps/web)** — CreatorMatch (separate influencer MVP scaffold).

## HomePulse (smart home)

```bash
cd smart-home
cp .env.example .env
docker compose up --build -d
./scripts/bootstrap_demo.sh
docker compose logs -f notifier
```

Full docs: [smart-home/README.md](./smart-home/README.md) · [smart-home/ARCHITECTURE.md](./smart-home/ARCHITECTURE.md)

---

# CreatoMatch

Upfluence-style UGC / influencer campaign platform.

Find creators by the content they share → outreach with templates → preview brief & terms → apply → pay or affiliate → track posts & metrics.

## Quick start

```bash
cd apps/web
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Or from repo root:

```bash
pnpm --dir apps/web install
pnpm db:reset
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo personas

Use the **Brand / Creator** switcher in the sidebar:

| Persona | Email | What to try |
|---------|-------|-------------|
| Brand | `brand@creatomatch.app` | Discovery search (`skincare`), campaign pipeline, accept applications, sync metrics, mark paid |
| Creator | `maya@creators.app` | Opportunities, preview brief, submit posts, view affiliate assets & earnings |

Seeded campaign: **Spring Glow Serum Launch** (hybrid paid + affiliate).

## What's included (MVP)

- Content-based creator discovery (caption/topic matching)
- Campaigns with brief, terms, deliverables, paid/gift/affiliate/hybrid
- Outreach templates with merge tags
- Creator brief preview + application flow
- Affiliate tracking links + promo codes
- Deliverable submission, metric sync stub, payouts & commissions
- Brand analytics dashboard

See [PLAN.md](./PLAN.md) for full product roadmap.
