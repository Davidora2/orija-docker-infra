# Orija Hosting Control Panel

Bluehost-style website manager for your WordPress hosting platform.

## Open the dashboard

**https://hosting.orija.store**

(Cloudflare Tunnel: `hosting.orija.store` → `http://localhost:18100`)

Sign in with your panel password → **Create website**.

Also works at `https://<any-site>/hosting/` on the same tunnel origin.

## Deploy / update

```bash
export PORTAINER_API_TOKEN=ptr_…
export PANEL_PASSWORD='your-panel-password'
./wordpress/scripts/deploy-panel.sh
```
