# Orija Docker Infra

Dockerized services for Orija commerce automation and creative production.

## Services

| Service | Path | Purpose |
|---------|------|---------|
| **Lifestyle Studio** | `services/lifestyle-studio/` | Nano Banana product lifestyle images — refs, draft reposition, high-res bake |
| **Pinterest Pin Agent** | `services/pinterest-pin-agent/` | Score Shopify products vs keywords, create pins, post to Pinterest (see other branches) |

## Lifestyle Studio (this branch)

Creates photorealistic lifestyle shots that stay faithful to your product references.
Draft at 1K, drag product/model placement when proportions are off, then approve and bake at 2K/4K.

```bash
cp services/lifestyle-studio/.env.example services/lifestyle-studio/.env
# set GEMINI_API_KEY=

docker compose up --build -d
# http://localhost:8080
```

Details: [`services/lifestyle-studio/README.md`](./services/lifestyle-studio/README.md)

Portainer stack: [`portainer/lifestyle-studio.stack.yml`](./portainer/lifestyle-studio.stack.yml)
