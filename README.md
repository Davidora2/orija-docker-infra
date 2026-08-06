# Orija product workspace

This repository currently hosts product experiments and MVPs.

## Life OS (planning)

Personal operating system product planning package:

- [docs/life-os/README.md](./docs/life-os/README.md) — index  
- [Technical Requirements](./docs/life-os/TECHNICAL_REQUIREMENTS.md)  
- [Feature Backlog](./docs/life-os/FEATURE_BACKLOG.md)  
- [User Stories](./docs/life-os/USER_STORIES.md)  
- [Product Brief](./docs/life-os/PRODUCT_BRIEF.md)  

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
