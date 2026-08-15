# Home Assistant inside HomePulse

Home Assistant runs next to HomePulse so you can use **Blink** (and other HA devices) from the HomePulse app.

## First-time setup

1. Open Home Assistant UI on the LAN: **http://YOUR_HOST:18123**  
   (HomePulse `/hass/` is a helper page with this link — HA cannot run under a `/hass/` subpath.)
2. Optional Cloudflare: `https://ha.YOUR_DOMAIN` → `http://localhost:18123`
3. Create the Home Assistant owner account
4. **Settings → Devices & services → Add integration → Blink** and sign in
5. **Profile → Security → Long-Lived Access Tokens → Create Token**
6. In Portainer stack env set:
   - `HA_BASE_URL=http://homeassistant:8123`
   - `HA_TOKEN=<the long-lived token>`
7. Redeploy / restart `home-registry`, or Admin → **Home Assistant**

## In the HomePulse app

- `/app/` shows a **Home Assistant** section: HA cameras (incl. Blink) + controllable entities
- Camera stills come through HomePulse (`/v1/member/.../ha/cameras/...`) so phones never need the HA token

## Blink doorbell → phone push

HomePulse `ha-ingest` listens to Home Assistant over websocket.

When you press the physical Blink button, HA updates `event.front_door_ding` (or similar).
HomePulse turns that into a `doorbell.ring` and notifies every subscribed phone.

Requirements:
1. Blink integration added in HA
2. `HA_TOKEN` set on the stack (already done if cameras show in `/app/`)
3. A Blink doorbell device registered in HomePulse Admin (you already have **Front Door Blink**)
4. Phones finished Join → Enable alerts → Allow

## Blink notes

- Live continuous RTSP is still limited by Blink’s cloud design
- HA can show camera entities, motion, and fetch clips via Blink services
- For 14-day local NVR recording, keep using Frigate + RTSP cameras; use Blink via HA for convenience stills/events

## Stack

| Service | Purpose |
|---------|---------|
| `homeassistant` | Official HA container |
| `homepulse-hass-config` | HA `/config` volume |
| Gateway `/hass/` | Proxied HA UI |
| Host port `18123` | Direct HA UI (optional LAN) |
