# Operations

Day-2 runbook for the WordPress hosting platform.

## Common tasks

### List sites

```bash
./wordpress/scripts/list-sites.sh
```

### Add a site

```bash
./wordpress/scripts/new-site.sh --slug SLUG --domain HOST --owner ACCOUNT --title "Title"
./wordpress/scripts/deploy-site.sh --slug SLUG
# + Cloudflare Tunnel hostname → http://localhost:18100
```

### Update a site stack (image pull / compose change)

Re-run `deploy-site.sh` after editing `wordpress/sites/<slug>/compose.yml`, or in Portainer: Stack → Editor → Update the stack → **Pull latest image**.

### Restart one site

Portainer → Containers → `wp-<slug>-app` / `wp-<slug>-db` → Restart  
Or: Stack → Stop → Start

### Remove a site

1. Backup first (below)
2. Portainer → delete stack `wp-<slug>` (optionally remove volumes)
3. Remove tunnel hostname
4. `./wordpress/scripts/remove-site.sh --slug SLUG --yes`

## Backups

### What to back up

| Volume | Contents |
|--------|----------|
| `wp_<slug>_data` | Themes, plugins, uploads, `wp-config.php` |
| `wp_<slug>_db` | MariaDB data directory |

### Database dump (preferred for restore granularity)

On the Docker host:

```bash
SLUG=acme
docker exec wp-${SLUG}-db mariadb-dump -u root -p"$MYSQL_ROOT_PASSWORD" wordpress \
  > "backup-${SLUG}-$(date +%F).sql"
```

Read `MYSQL_ROOT_PASSWORD` from the stack env in Portainer or from local `CREDENTIALS.txt`.

### Filesystem / volume archive

```bash
SLUG=acme
docker run --rm \
  -v "wp_${SLUG}_data":/data:ro \
  -v "$PWD:/out" \
  alpine tar czf "/out/wp-${SLUG}-data-$(date +%F).tgz" -C /data .
```

Repeat for `wp_${SLUG}_db` if you skip SQL dumps (cold backup: stop DB first).

### Restore (SQL)

```bash
docker exec -i wp-${SLUG}-db mariadb -u root -p"$MYSQL_ROOT_PASSWORD" wordpress < backup.sql
```

## Updates

| Component | How |
|-----------|-----|
| WordPress core | Prefer WP Admin → Updates, or bump image tag in compose then redeploy |
| MariaDB | Change `mariadb:11.4` tag carefully; backup first |
| Traefik / Redis | Edit `wordpress/platform/compose.yml`, redeploy `wp-platform` |

Pin image digests in production if you need fully reproducible deploys.

## Logs & health

```bash
# On Docker host
docker logs wp-traefik --tail 100
docker logs wp-acme-app --tail 100
docker logs wp-acme-db --tail 100

curl -fsS http://localhost:18101/api/http/routers   # Traefik routers (private)
curl -fsS -H "Host: acme.orija.store" http://localhost:18100/
```

Portainer → Containers → Logs works without SSH.

## Resource limits (optional)

Add under each service in the site compose before deploy:

```yaml
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G
```

On non-Swarm Portainer standalone, prefer:

```yaml
    mem_limit: 1g
    cpus: 1.0
```

## WP-CLI helper (optional)

```bash
docker exec -u www-data wp-acme-app wp --info
docker exec -u www-data wp-acme-app wp user list
docker exec -u www-data wp-acme-app wp user create editor editor@example.com --role=editor --user_pass='...'
```

Official `wordpress:` image may need WP-CLI installed; alternative:

```bash
docker run --rm -it --volumes-from wp-acme-app --network container:wp-acme-app \
  wordpress:cli wp user list
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 404 / wrong site | Traefik Host rule vs Tunnel hostname; `docker logs wp-traefik` |
| Site unreachable | Is `wp-platform` up? Is tunnel → `18100`? Is site on `wp-public`? |
| DB connection error | Site `.env` passwords; `wp-<slug>-db` healthy? |
| Port conflict on deploy | Another stack using `18100`/`18101` — change platform ports + tunnel |
| Mixed HTTP/HTTPS | Ensure `X-Forwarded-Proto` middleware / `WORDPRESS_CONFIG_EXTRA` HTTPS block |
| Cannot create stack | Token permissions; endpoint id; network `wp-public` missing → deploy platform first |

## Capacity planning (rule of thumb)

| Host RAM | Concurrent small WP sites (approx.) |
|----------|--------------------------------------|
| 8 GB | ~8–12 |
| 16 GB | ~20–30 |
| 32 GB | ~40–60 |

Actual usage depends on plugins, traffic, and PHP workers. Prefer memory limits per stack and Redis object caching for busy sites.
