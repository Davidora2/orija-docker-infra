# Orija Hosting Control Panel

Bluehost-style website manager for your WordPress hosting platform.

## Open the dashboard (easiest)

Because `test.orija.store` already points at the platform, use:

**https://test.orija.store/hosting/**

Sign in with your panel password → **Create website**.

No new Cloudflare hostname required.

## Optional dedicated address

Later you can also add `hosting.orija.store` → `http://localhost:18100` and use https://hosting.orija.store

## Deploy / update

```bash
export PORTAINER_API_TOKEN=ptr_…
export PANEL_PASSWORD='your-panel-password'
./wordpress/scripts/deploy-panel.sh
```
