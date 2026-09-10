# Immich File Request

Dropbox-style **file requests** for collecting photos and videos, then moving them into Immich **external library** folders from an admin screen.

This avoids Immich’s own upload path (and error 592 / reverse-proxy upload limits). People only get a public request link. You copy or move the files into folders Immich already watches.

## Flow

1. Admin creates a request (“Wedding weekend photos”) and copies the link.
2. Anyone with the link drops images (no Immich account).
3. Admin reviews files, picks an Immich external folder (`Family`, `Vacation`, `Inbox`, …), and **Copy** or **Move**.
4. Immich picks them up on the next external-library scan.

```
Phone / laptop  →  /r/<id> upload page  →  staging (data/uploads)
Admin           →  /admin               →  copy/move into Immich external folders
Immich          →  watches those folders as external libraries
```

## Quick start

```bash
cd tools/file-request
cp .env.example .env
# edit IMMICH_FOLDERS to real Immich external-library paths
pnpm install   # or: npm install
pnpm start
```

Open [http://localhost:3847/admin](http://localhost:3847/admin). Default password from `.env.example` is `change-me`.

Share links look like `http://localhost:3847/r/<id>`.

## Point folders at Immich

Set `IMMICH_FOLDERS` to the same directories Immich uses as **external libraries**. Examples:

```env
# Local mounts
IMMICH_FOLDERS=Inbox=/mnt/immich/external/inbox,Family=/mnt/immich/external/family

# SMB / CIFS already mounted on the host
IMMICH_FOLDERS=Family=/mnt/smb/photos/family,Vacation=/mnt/smb/photos/vacation
```

In Immich: **Administration → External Libraries → Add library** for each of those paths (or bind-mount them into the Immich container at the same path). After you move files, run **Scan** on that library if it does not pick them up automatically.

## Docker

From this directory:

```bash
docker compose up -d --build
```

Bind-mount your Immich library folders over `./data/immich-external/...` (see `docker-compose.yml`).

## API (optional)

Admin calls need header `x-admin-password` when `ADMIN_PASSWORD` is set.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/requests` | Create request `{ title, description }` |
| GET | `/api/admin/requests` | List requests + uploaded files |
| POST | `/api/requests/:id/upload` | Multipart field `files` (+ `uploaderName`, `note`) |
| POST | `/api/admin/move` | `{ requestId, fileIds, folderId, mode: "copy" \| "move" }` |

## Notes

- Staging files live in `data/uploads/<request-id>/`. Do not point Immich at that folder.
- `Copy` keeps a staging copy; `Move` relocates the file into the Immich folder.
- Name collisions in the destination get a short suffix.
- Leave `ADMIN_PASSWORD` empty only on a trusted LAN.
