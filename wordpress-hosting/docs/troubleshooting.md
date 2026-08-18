# Troubleshooting

## Site not reachable publicly

1. `./scripts/list-sites.sh` — confirm `host_port` and `domain`
2. On the Docker host: `curl -sI http://127.0.0.1:$HOST_PORT`
3. Cloudflare Tunnel public hostname → `http://localhost:$HOST_PORT`
4. DNS A/CNAME for the hostname points at the tunnel

## Portainer stack create fails with Cloudflare 524

Avoid `build:` in compose. This template uses public images only (`wordpress`, `mariadb`, `wordpress:cli`, `redis`).

## `network wp-platform declared as external, but could not be found`

Deploy platform first:

```bash
./scripts/deploy-platform.sh
```

## `wp-init` keeps restarting / admin user missing

Check logs for the `wp-init` container. Common causes:

- DB not ready (should wait on healthcheck)
- Wrong `SITE_DOMAIN` / empty admin password env
- Volume already partially installed — exec WP-CLI manually

```bash
docker exec -u www-data <wordpress_ctr> wp core is-installed
docker exec -u www-data <wordpress_ctr> wp user list
```

## Mixed content / redirect loops

Ensure tunnel terminates TLS and forwards to HTTP origin. The template sets:

- `FORCE_SSL_ADMIN`
- `HTTP_X_FORWARDED_PROTO` → `HTTPS` detection
- `WP_HOME` / `WP_SITEURL` to `https://$SITE_DOMAIN`

## Redis Object Cache not active

Plugin install is best-effort in `wp-init`. Manually:

1. WP Admin → Plugins → install **Redis Object Cache**
2. Enable object cache
3. Confirm `WP_REDIS_HOST=redis` and site is on `wp-platform` network

## Out of ports

Widen `port_range` in `sites/registry.yaml` or free ports by removing retired sites.

## Need to change domain

1. Update Cloudflare Tunnel hostname
2. Update `SITE_DOMAIN` in Portainer env + redeploy
3. WP-CLI search-replace old URL → new URL
4. Update `sites/registry.yaml`

## Token cannot see stacks

Non-admin Portainer tokens only see their own stacks. Create stacks with the same token you use for redeploy, or use an admin token carefully.
