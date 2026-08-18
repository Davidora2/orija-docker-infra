# Portainer stack template notes

Import these as reusable mental templates (Portainer Custom Templates) if you prefer UI-only workflows.

## Template A — WordPress Platform

- **Title:** WordPress Platform (Traefik + Redis)
- **Description:** Shared edge proxy for all WP sites. Deploy once per host.
- **Compose:** contents of `wordpress/platform/compose.yml`
- **Env:**

```
PLATFORM_HTTP_PORT=18100
PLATFORM_DASHBOARD_PORT=18101
TRAEFIK_LOG_LEVEL=INFO
TRAEFIK_ACCESS_LOG=true
```

## Template B — WordPress Site

Prefer generating from `scripts/new-site.sh` rather than a single static template, because each site needs unique:

- Traefik router name / Host rule
- Volume names
- Container names
- Owner labels

Workflow:

1. Run `new-site.sh` on a workstation or agent
2. Create Portainer stack from generated `compose.yml` + `.env`
3. Or use `deploy-site.sh`

## Suggested Portainer labels (already applied)

| Label | Example |
|-------|---------|
| `com.orija.stack` | `wp-acme` |
| `com.orija.site` | `acme` |
| `com.orija.owner` | `alice` |
| `com.orija.domain` | `acme.orija.store` |
| `com.orija.role` | `wordpress` / `database` / `edge-proxy` |

Filter containers in Portainer by these labels when auditing.
