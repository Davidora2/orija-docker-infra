# Orija

Plex-style personal media server in Docker. Pulls live TV, movies, and shows from an **Xtream Codes** subscription, supports **multi-streaming** with personalized accounts, saves favorited titles into local **Movies/Shows** folders, and serves either those local files or direct Xtream streams.

## Features

- **Xtream Codes** catalog (movies, series, live TV) via `player_api.php`
- **Multi-stream** sessions with per-user and global concurrency limits
- **Personalized accounts** (admin + members), each with their own favorites & watch progress
- **Favorite → library**: starring an Xtream movie/show queues a download into `/media/movies` or `/media/shows`
- **Local library** scanner + playback for files already on disk
- Single Docker image (FastAPI API + React UI)

## Quick start

```bash
cp .env.example .env
# edit XTREAM_* and ADMIN_PASSWORD
docker compose up -d --build
```

Open **http://localhost:8096** and sign in with `admin` / `admin` (or your `.env` values).

In **Settings**, paste your Xtream server URL, username, and password, then **Save & Test**.

### Volumes

| Path | Purpose |
|------|---------|
| `/media/movies` | Local movies + favorited Xtream movies |
| `/media/shows` | Local / favorited series episodes |
| `/media/live` | Optional live recordings |
| `/data` | SQLite database |

Map host folders via `MOVIES_PATH` / `SHOWS_PATH` in `.env`.

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
mkdir -p /tmp/orija/{data,movies,shows,live,downloads}
export DATABASE_URL=sqlite+aiosqlite:////tmp/orija/data/orija.db
export MOVIES_DIR=/tmp/orija/movies SHOWS_DIR=/tmp/orija/shows
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## API overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Get JWT |
| `GET /api/xtream/catalog/{movies\|shows\|live}` | Browse Xtream |
| `POST /api/streams/open` | Open a counted stream session |
| `GET /api/streams/play/{session_key}` | Proxied play URL (local or Xtream) |
| `POST /api/favorites` | Favorite (+ optional download to disk) |
| `POST /api/library/scan` | Rescan local media folders |

## Notes

- Use only with an Xtream subscription you are authorized to access.
- Provider connection limits still apply; Orija enforces its own multi-stream caps on top.
- Series favorites currently download the first available episode into the Shows folder as a starter; re-run **Save again** or expand the downloader for full-season grabs as needed.
