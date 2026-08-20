# orija-docker-infra

Docker / Portainer infrastructure for Orija.

## Easiest: Hosting Control Panel (Bluehost-style)

Manage many WordPress websites from a web dashboard — create, view logins, delete — without using the terminal.

1. Open **https://hosting.orija.store** (after the panel is deployed + tunnel set)
2. Sign in with your hosting panel password
3. Click **Create website**

Details: [`wordpress/panel/README.md`](./wordpress/panel/README.md)

## WordPress platform (under the hood)

Shared Traefik edge (`wp-platform` on port `18100`) + one stack per site (`wp-<slug>`).

Full docs: [`wordpress/README.md`](./wordpress/README.md)

## Other apps

`apps/web` contains CreatoMatch. See that app’s README for local Node development.

## Portainer skill

Cloud Agents: `.cursor/skills/portainer-deploy/SKILL.md`
