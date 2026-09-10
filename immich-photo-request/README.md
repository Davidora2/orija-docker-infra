# Immich Photo Request

Browser tool for Immich users to **request photos from other people**.

1. An Immich user creates a request and gets a shareable link  
2. Guests open the link on phone/desktop and upload photos in the browser  
3. Files are written into that user’s **Immich external library folder** (bind mount or SMB/NAS path)  
4. Optionally trigger an Immich library scan so photos appear without waiting for the next scheduled scan  

This avoids uploading large guest files through Immich’s Cloudflare-facing upload API (100MB limit), because guests write into a folder Immich already watches.

## Quick start (local)

```bash
cd immich-photo-request
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

mkdir -p /tmp/immich-photo-request/{external,app}
export DEV_MODE=true
export EXTERNAL_LIBRARY_ROOT=/tmp/immich-photo-request/external
export DATABASE_PATH=/tmp/immich-photo-request/app/app.db
export PUBLIC_BASE_URL=http://localhost:8090
export IMMICH_BASE_URL=https://photos.orija.store

uvicorn app.main:app --host 0.0.0.0 --port 8090 --app-dir .
```

Open http://localhost:8090 — in `DEV_MODE` any API key works.

## Wire to Immich external library / SMB

1. On the host (or NAS), create a shared folder, e.g. `/mnt/immich-inbox` or an SMB share `//nas/photos/inbox`.
2. Mount that path into **Immich** as an external library import path.
3. Mount the **same** path into this app as `IMMICH_EXTERNAL_HOST_PATH`.
4. In Immich Admin → Libraries → create/select an **External** library pointing at that path (or a user subfolder).
5. Users of this app get folders like:

```text
{external_root}/{user-slug}/requests/{request-id}/photo.jpg
```

6. After guests upload, either:
   - wait for Immich’s next library scan, or  
   - set `IMMICH_SCAN_API_KEY` (+ optional `IMMICH_LIBRARY_ID`) so this app triggers `POST /api/libraries/{id}/scan`.

### Example Portainer / Compose env

```env
PUBLIC_BASE_URL=https://request.photos.orija.store
IMMICH_BASE_URL=https://photos.orija.store
IMMICH_EXTERNAL_HOST_PATH=/mnt/immich-inbox
IMMICH_SCAN_API_KEY=...
IMMICH_LIBRARY_ID=...
```

Publish on a high port (compose uses `18090:8090`) and point Cloudflare Tunnel at `http://localhost:18090`.

## Immich API key permissions

For request creators:

- Validate identity: user read (`/api/users/me`)
- Optional auto-scan: library read + library update

Create keys in Immich → Account Settings → API Keys.

## Security notes

- Request links are unguessable tokens; still treat them like capability URLs.
- Default max file size is ~95MB to stay under Cloudflare’s proxy limit if this app is also behind CF.
- For large guest video drops, put this app on VPN/LAN or grey-cloud DNS, or keep using the folder/SMB path and scan locally.

## API sketch

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | — | Owner UI |
| GET | `/r/{token}` | — | Guest upload page |
| GET | `/api/me` | API key | Current Immich user |
| GET | `/api/libraries` | API key | List Immich libraries |
| POST | `/api/requests` | API key | Create request + link |
| GET | `/api/requests` | API key | List requests |
| POST | `/api/requests/{id}/close` | API key | Close request |
| POST | `/api/r/{token}/upload` | — | Guest multipart upload |
