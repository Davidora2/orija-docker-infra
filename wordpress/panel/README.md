# Orija Hosting Control Panel

Bluehost-style website manager for your WordPress hosting platform.

## Open the dashboard

**https://hosting.orija.store**

Cloudflare Tunnel: `hosting.orija.store` → **HTTP `localhost:18100`**

## What about test.orija.store?

Same origin — Traefik picks the site by hostname:

| Hostname | Tunnel service |
|----------|----------------|
| `hosting.orija.store` | `http://localhost:18100` (control panel) |
| `test.orija.store` | `http://localhost:18100` (WordPress test site) |
| `any-other.orija.store` | `http://localhost:18100` (each WP site you create) |

You do **not** use a different port per site. Every public hostname points to **18100**.

## Password change & recovery

- **Change password:** sign in → **Password**
- **Forgot password:** sign-in screen → **Forgot password?** → enter recovery code
- First login may show a recovery code banner — save it, then hide it
- Emergency override: set Portainer env `PANEL_PASSWORD_RESET=newpassword` and redeploy/restart `wp-panel` once

## WordPress site passwords

Each website has its own WordPress login (shown when you create the site).  
Reset those inside WordPress (**Users** or “Lost your password” on `/wp-login.php`).

## Deploy / update

```bash
export PORTAINER_API_TOKEN=ptr_…
export PANEL_PASSWORD='your-panel-password'
./wordpress/scripts/deploy-panel.sh
```
