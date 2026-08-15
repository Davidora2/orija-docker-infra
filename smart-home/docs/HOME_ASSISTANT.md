# Home Assistant inside HomePulse

Home Assistant runs next to HomePulse so you can use **Blink** (and other HA devices) from the HomePulse app.

## First-time setup

1. Open **https://homepulse.YOUR_DOMAIN/hass/** (or `http://HOST:18123`)
2. Create the Home Assistant owner account
3. **Settings → Devices & services → Add integration → Blink** and sign in
4. **Profile → Security → Long-Lived Access Tokens → Create Token**
5. In Portainer stack env set:
   - `HA_BASE_URL=http://homeassistant:8123`
   - `HA_TOKEN=<the long-lived token>`
6. Redeploy / restart `home-registry`, or Admin → **Home Assistant → Test connection**

## In the HomePulse app

- `/app/` shows a **Home Assistant** section: HA cameras (incl. Blink) + controllable entities
- Camera stills come through HomePulse (`/v1/member/.../ha/cameras/...`) so phones never need the HA token

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
