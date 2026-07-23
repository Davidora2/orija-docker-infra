# OrijaFlix

Plex-style personal media server in Docker — branded **OrijaFlix**. Pulls live TV, movies, and shows from an **Xtream Codes** subscription, supports **multi-streaming** with personalized accounts, saves favorited titles into local **movies** / **TVshows** folders, sorts messy filenames + fetches cover art, and serves either local files or Xtream streams.

## Media layout

```
/srv/storage/data/media/
  movies/          # Movie Name (2020)/Movie Name (2020).mkv + poster.jpg
  TVshows/         # Show Name/Season 01/Show Name - S01E01 - Title.mkv + poster.jpg
  incoming/        # Drop zone for the media sorter
  downloads/       # Also scanned by the sorter
```

Mount this host path into the container via `MEDIA_HOST_PATH` (default `/srv/storage/data/media`).

## Features

- **Xtream Codes** catalog (movies, series, live TV)
- **Multi-stream** sessions with per-user and global concurrency limits
- **Personalized accounts** — favorites & watch progress per user
- **Favorite → library** downloads into `movies/` or `TVshows/`
- **Media sorter** — rename, classify movie vs TV, move to the right folder, fetch TMDB artwork
- **Local library** scanner + playback
- Native apps: Android · Android TV · iOS (`mobile/`)

## Quick start

### Portainer / stack deploy (private GitHub)

**Option A — Build image once, then paste compose (no Git in Portainer)**  

On the Docker/Portainer host:
```bash
git clone https://github.com/Davidora2/orija-docker-infra.git
cd orija-docker-infra && git checkout cursor/xtream-media-server-8dc5
bash scripts/build-image.sh   # creates orijaflix:latest
```

Then in Portainer → Stacks → **Web editor**, paste `docker-compose.portainer.yml`
(or the filled stack from your notes). No Dockerfile/Git access needed at deploy time.

**Option B — Repository stack**  
Stacks → Add stack → **Repository**:
- URL: `https://github.com/Davidora2/orija-docker-infra`
- Branch: `cursor/xtream-media-server-8dc5`
- Compose path: `docker-compose.local.yml`
- Enable **authentication** → GitHub username + **Personal Access Token** (scope `repo`)

**Option C — Paste YAML that builds from private Git**  
Use `docker-compose.yml` and set stack env: `GITHUB_TOKEN`, `GITHUB_USER=x-access-token`.

### CLI (local clone)

```bash
git clone https://github.com/Davidora2/orija-docker-infra.git
cd orija-docker-infra
git checkout cursor/xtream-media-server-8dc5
cp .env.example .env
docker compose -f docker-compose.local.yml up -d --build
```

Or from this repo root (GitHub remote build):

```bash
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:8096** and sign in with `admin` / `admin`.

In **Settings**, paste your Xtream server URL, username, and password.  
In **Local Library**, use **Preview sort** / **Run sorter** on files in `incoming/`.

## Native apps (Android · Android TV · iOS)

```bash
cd mobile && npm install && npx expo start
# production: eas build -p android|ios
```

Enter your OrijaFlix LAN URL (e.g. `http://192.168.1.50:8096`). See [mobile/README.md](./mobile/README.md).

## Volumes

| Path | Purpose |
|------|---------|
| `/srv/storage/data/media/movies` | Movies + favorited Xtream movies |
| `/srv/storage/data/media/TVshows` | TV shows / favorited series |
| `/srv/storage/data/media/incoming` | Sorter inbox |
| `/data` | SQLite database |

## Sorter API

| Endpoint | Description |
|----------|-------------|
| `GET /api/sorter/status` | Pending files + folder paths |
| `POST /api/sorter/preview` | Dry-run rename/move plan |
| `POST /api/sorter/run` | Apply plan + download posters |

Set `TMDB_API_KEY` in `.env` for TMDB title matching and cover art.

## Development

```bash
cd backend
pip install -r requirements.txt
export MEDIA_ROOT=/tmp/orijaflix/media
mkdir -p $MEDIA_ROOT/{movies,TVshows,incoming,downloads}
uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev
```
