# Cameras & 14-day recordings (Frigate)

HomePulse uses **Frigate** for live camera views and activity recording.

## Retention

Recordings keep **14 days** of motion/activity, then older footage is removed automatically (`record.retain.days: 14`, `mode: motion`).

## Family access

1. Invite family (Admin → Invite family)
2. They open the join link → Enable alerts → **Open cameras & devices**
3. Home app: `https://homepulse.YOUR_DOMAIN/app/`

Members can:
- View live camera snapshots
- Browse recent activity clips (within 14 days)
- Control home devices (lights, locks, siren) that have MQTT topics
- Toggle Away / Armed

## Admin: add a camera

1. Admin → Add device → **Preset: Camera (14-day record)**
2. Set camera name (External ID), e.g. `front`
3. Paste **RTSP URL** from the camera
4. Save — HomePulse syncs Frigate config (`POST /v1/admin/frigate/sync` also available)

## Stack pieces

| Piece | Role |
|-------|------|
| `frigate` service | NVR + detect + 14-day media volume |
| `homepulse-frigate-media` | Recording storage |
| `homepulse-frigate-config` | Generated `config.yml` |
| Gateway `/app/` | Member UI |
| Gateway `/v1/member/*` | Auth’d camera proxy + device commands |

Frigate is **not** exposed on a host port; phones only reach it through HomePulse’s authenticated member APIs.
