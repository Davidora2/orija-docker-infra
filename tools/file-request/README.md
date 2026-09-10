# Immich File Request

Dropbox-style **file requests** for collecting photos and videos. People upload through a public link. You send the files into a chosen **Immich user** (via that user’s API key) and optionally into one of their **albums**.

This avoids guests using Immich’s own upload UI (and typical reverse-proxy / error 592 issues).

## Flow

1. In admin, set your Immich URL and paste each user’s API key (Immich → Account Settings → API Keys).
2. Create a request (“Wedding weekend photos”) and share `/r/<id>`.
3. Anyone with the link drops photos (no Immich account).
4. Admin picks **user + album** (or Library / new album) and clicks **Send to Immich**.
5. Files are uploaded with that user’s key, so they land in that person’s library.

```
Phone / laptop  →  /r/<id>  →  staging
Admin           →  /admin   →  Immich API (user key) → that user’s library / album
```

## Quick start

```bash
cd tools/file-request
cp .env.example .env
npm install
npm start
```

Open [http://localhost:3847/admin](http://localhost:3847/admin). Default password is `change-me`.

1. Save Immich server URL (example: `http://192.168.1.10:2283`).
2. For each Immich user, create an API key with **asset upload** and **album** permissions, then paste it.
3. Create a request link and send it to people.

## API keys

Each Immich user needs their own key. Uploads are owned by whoever owns the key.

Recommended key permissions: `asset.upload`, `album.read`, `album.create`, `albumAsset.create`, `user.read`.

## Optional disk folders

You can still copy/move files into directories Immich watches as **external libraries** (`IMMICH_FOLDERS` in `.env`). That is a fallback, not the main path.

## Docker

```bash
docker compose up -d --build
```

Set `IMMICH_URL` if you want a default server URL. User keys are stored in `./data/settings.json`.

## API (optional)

Admin calls need header `x-admin-password` when `ADMIN_PASSWORD` is set.

| Method | Path | Purpose |
|--------|------|---------|
| PUT | `/api/admin/immich/url` | `{ url }` |
| POST | `/api/admin/immich/users` | `{ apiKey, label }` — validates via Immich `/users/me` |
| GET | `/api/admin/immich/users/:id/albums` | That user’s albums |
| POST | `/api/admin/send-to-immich` | `{ requestId, fileIds, userId, albumId? }` |
| POST | `/api/admin/requests` | Create request |
| POST | `/api/requests/:id/upload` | Public multipart `files` |

## Notes

- Staging files live in `data/uploads/<request-id>/`.
- API keys are stored in `data/settings.json` and never sent back to the browser (only a masked suffix).
- Leave `ADMIN_PASSWORD` empty only on a trusted LAN.
