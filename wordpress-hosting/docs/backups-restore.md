# Backups and restore

## What to back up

Per site:

| Data | Location | Critical |
|------|----------|----------|
| Database | MariaDB volume / dump | Yes |
| Uploads, themes, plugins | `wp-content` inside HTML volume | Yes |
| Secrets | Portainer env / `sites/<slug>/.env` | Yes (offline vault) |
| Registry row | `sites/registry.yaml` | Nice to have |

## Automated helper (on the Docker host)

```bash
./scripts/backup-site.sh acme
# → sites/acme/backups/<timestamp>/{database.sql,wp-content.tar.gz,manifest.txt}
```

Run via cron on `odserver2` for each production slug, or wrap in a small systemd timer.

## Manual DB dump

```bash
docker exec -i <db_container> \
  mariadb-dump -uwordpress -p"$MYSQL_PASSWORD" wordpress > acme.sql
```

## Manual files archive

```bash
docker exec <wordpress_container> \
  tar -C /var/www/html -czf - wp-content > acme-wp-content.tar.gz
```

## Restore (outline)

1. Provision a fresh stack with the **same** `SITE_SLUG` (volumes must be empty or removed)
2. Start stack so MariaDB initializes
3. Import SQL:

```bash
docker exec -i <db_container> \
  mariadb -uwordpress -p"$MYSQL_PASSWORD" wordpress < database.sql
```

4. Extract files:

```bash
docker exec -i <wordpress_container> \
  tar -C /var/www/html -xzf - < wp-content.tar.gz
```

5. If the domain changed, search-replace URLs:

```bash
docker exec -u www-data <wordpress_container> \
  wp search-replace 'https://old.example' 'https://new.example' --all-tables
```

## Offsite copies

Copy `sites/<slug>/backups/` to object storage (R2/S3/B2) nightly. Encrypt tarballs if they leave the trust boundary.

## Retention suggestion

| Environment | Keep |
|-------------|------|
| Production | 14 daily + 4 weekly |
| Staging | 3 daily |
