# Orija Lifestyle Studio

Dockerized web app that connects to **Nano Banana** (Gemini image models) to create
photorealistic product lifestyle images with accurate product fidelity, optional
realistic models, reference images, draft repositioning, and high-res bake.

## Workflow

1. **Upload product references** (and optional model / style refs)
2. **Describe the scene** — setting, lighting, camera, aspect ratio
3. **Generate draft** at 1K for fast iteration
4. **Draft studio** — drag Product / Model anchors (or use sliders) when placement or proportions are off, then **Apply layout move**
5. **Approve & bake** — locks the approved composition and regenerates at 2K / 4K

Product prompts enforce logo, color, material, silhouette, and real-world scale fidelity.

## Quick start

```bash
cp services/lifestyle-studio/.env.example services/lifestyle-studio/.env
# Add GEMINI_API_KEY from https://aistudio.google.com/apikey

docker compose up --build -d
# open http://localhost:8080
```

Without an API key, `ALLOW_MOCK_WITHOUT_KEY=true` still lets you exercise the UI with placeholder drafts.

## Models

| Stage | Default | Nano Banana name |
|-------|---------|------------------|
| Draft | `gemini-3.1-flash-image` | Nano Banana 2 |
| Bake  | `gemini-3-pro-image` | Nano Banana Pro |

Override via `.env` (`NANOBANANA_DRAFT_MODEL`, `NANOBANANA_BAKE_MODEL`, sizes).

## Portainer

Use [`portainer/lifestyle-studio.stack.yml`](../../portainer/lifestyle-studio.stack.yml).
Set `GEMINI_API_KEY` as a stack environment variable.

## API sketch

- `POST /api/projects` — create session
- `POST /api/projects/{id}/refs/{product\|model\|style}` — upload refs
- `POST /api/projects/{id}/generate` — draft
- `POST /api/projects/{id}/reposition` — apply layout moves
- `POST /api/projects/{id}/bake` — high-res bake

## Local (no Docker)

```bash
cd services/lifestyle-studio
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=src DATA_DIR=../../data/lifestyle-studio
cp .env.example .env
python -m lifestyle_studio
```
