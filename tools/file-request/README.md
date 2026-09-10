# Immich File Request

Dropbox-style **file requests** for collecting photos and videos. People upload through a public link. You send the files into a chosen **Immich user** (via that user’s API key) and optionally into one of their **albums**.

This is its **own Docker stack**. Run it on the same host as Immich; it does not get merged into the Immich compose file.

## Flow

1. In admin, set your Immich URL and paste each user’s API key (Immich → Account Settings → API Keys).
2. Create a request (“Wedding weekend photos”) and share `/r/<id>`.
3. Anyone with the link drops photos or videos (no Immich account, **no size cap**).
4. Admin picks **user + album** (or Library / new album) and clicks **Send to Immich**.
5. Files are uploaded with that user’s key, so they land in that person’s library.

Public uploads (web link and phone app) are always sent as **8MB chunks**. That bypasses Cloudflare Tunnel’s ~100MB per-request cap. There is **no total file-size limit** on the relay. The relay then streams the assembled file to Immich on the LAN (set `IMMICH_URL` to the LAN/Docker URL, not the tunneled hostname).

```
Phone / laptop  →  8MB chunks (no size cap)  →  relay on your host  →  Immich LAN API
```

## Run as its own stack (same host as Immich)

On the Immich machine:

```bash
cd tools/file-request
cp .env.example .env
# set BASE_URL if you reverse-proxy this app
docker compose up -d --build
```

Open [http://localhost:3847/admin](http://localhost:3847/admin). Default password is `change-me`.

`.env` defaults `IMMICH_URL` to `http://host.docker.internal:2283` (Immich’s usual published port on this host). Paste each user’s API key in the admin UI.

```bash
docker compose ps
docker compose logs -f
docker compose down
```

Compose project name is `file-request` (`container_name: file-request`), so it sits next to Immich instead of inside it.

On the Orija Portainer host (`portainer.orija.store`, endpoint `local`):

```bash
# Agents deploy this via Portainer API from tools/file-request/compose.portainer.yml
# Published origin: host port 13847 → container 3847
# Public send page: https://lifeos.orija.store/send
# Immich is not modified; this stack only stores incoming files.
```

If Immich is not published on the host and you would rather use its Docker network:

```bash
docker network ls | grep -i immich
# set IMMICH_DOCKER_NETWORK and IMMICH_URL=http://immich-server:2283 in .env
docker compose -f docker-compose.yml -f docker-compose.immich-network.yml up -d
```

## Uploads are not size-capped

The phone app in `mobile/` and the public `/r/<id>` page both send files as **8MB chunks** over the public URL. The relay reassembles on disk, then uploads to Immich on the LAN. Cloudflare’s ~100MB request cap does not apply, and this stack does not impose a total file-size limit.

See [mobile/README.md](./mobile/README.md).

## API keys

Recommended key permissions: `asset.upload`, `album.read`, `album.create`, `albumAsset.create`, `user.read`.

## Optional disk folders

You can still copy/move files into directories Immich watches as **external libraries** (`IMMICH_FOLDERS` in `.env`). That is a fallback, not the main path.

## Run without Docker

```bash
cd tools/file-request
cp .env.example .env
npm install
npm start
```

## API (optional)

Admin calls need header `x-admin-password` when `ADMIN_PASSWORD` is set.

| Method | Path | Purpose |
|--------|------|---------|
| PUT | `/api/admin/immich/url` | `{ url }` |
| POST | `/api/admin/immich/users` | `{ apiKey, label }` — validates via Immich `/users/me` |
| GET | `/api/admin/immich/users/:id/albums` | That user’s albums |
| POST | `/api/admin/send-to-immich` | `{ requestId, fileIds, userId, albumId? }` |
| POST | `/api/admin/requests` | Create request |
| POST | `/api/requests/:id/uploads` | Start a chunked public upload (`{ filename, size, mime }`) |
| PUT | `/api/requests/:id/uploads/:uploadId/chunks/:index` | 8MB binary chunk |
| POST | `/api/requests/:id/uploads/:uploadId/complete` | Finish chunked public upload |
| POST | `/api/inbox/:token/uploads` | Start a phone inbox upload |
| PUT | `/api/inbox/:token/uploads/:uploadId/chunks/:index` | 8MB binary chunk |
| POST | `/api/inbox/:token/uploads/:uploadId/complete` | Reassemble and send to Immich |

## Notes

- Staging files live in `data/uploads/<request-id>/`.
- API keys are stored in `data/settings.json` and never sent back to the browser (only a masked suffix).
- Leave `ADMIN_PASSWORD` empty only on a trusted LAN.
