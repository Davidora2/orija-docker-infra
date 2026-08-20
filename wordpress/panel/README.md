# Orija Hosting Control Panel

A simple **Bluehost-style** website manager for your WordPress hosting platform.

## What you can do in the browser

1. Sign in with a panel password
2. See all your websites
3. Click **Create website** (name + address + email)
4. Get WordPress admin username/password on screen
5. Delete sites you no longer need

No Portainer, no terminal, no Docker knowledge required for day-to-day use.

## Address

After Cloudflare Tunnel is set:

**https://hosting.orija.store**

Tunnel rule: `hosting.orija.store` → `http://localhost:18100`

## Deploy (once)

```bash
export PORTAINER_API_TOKEN=ptr_…
export PANEL_PASSWORD='choose-a-long-password'
export PANEL_SESSION_SECRET=$(openssl rand -hex 32)

# Create stack via Portainer string API or UI using wordpress/panel/compose.yml
```

Env vars:

| Name | Purpose |
|------|---------|
| `PORTAINER_API_TOKEN` | Creates WordPress stacks for you |
| `PANEL_PASSWORD` | Login for this control panel |
| `PANEL_SESSION_SECRET` | Cookie signing key |
| `PANEL_DOMAIN` | Default `hosting.orija.store` |
| `PANEL_GIT_REF` | Git branch that contains this panel code |

## For non-technical users

Bookmark **https://hosting.orija.store** — that is your hosting dashboard.
Each new site still needs its domain added once in Cloudflare Tunnel (same origin port `18100`).
