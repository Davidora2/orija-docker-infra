# Scaling

## Primary scale path: more stacks

Each new website is another `wp-<slug>` Portainer stack. This is how you scale **accounts** and **sites**.

```bash
./scripts/provision-site.sh --slug newsite --domain newsite.orija.store --deploy
```

Port allocator uses `sites/registry.yaml` → `port_range` (default `19100–19999` ≈ 900 sites per host before you widen the range).

## Per-site resources

Tune via env before deploy/redeploy:

| Variable | Default | When to raise |
|----------|---------|----------------|
| `WP_MEMORY_LIMIT` | `256M` | Heavy page builders / WooCommerce |
| `WP_MAX_MEMORY_LIMIT` | `512M` | WP-Admin / imports |
| Redis `REDIS_MAXMEMORY` | `512mb` | Many sites using object cache |

Add Docker `deploy.resources` limits in the template if you need hard caps (Swarm) or use Portainer host constraints.

## Shared Redis

`wp-platform` Redis is shared. Keys are prefixed with `SITE_SLUG:`. If Redis becomes hot:

1. Raise `REDIS_MAXMEMORY`
2. Or split a second Redis network for VIP sites
3. Or disable object cache on low-traffic sites

## Database density alternative

Today: **1 MariaDB container per site** (isolation first).  
If you outgrow container count, introduce a managed/shared MariaDB with per-site databases and a thinner WordPress-only template. Keep the same registry/scripts interface so operators don’t change habits.

## Multi-host

1. Add a second Portainer endpoint
2. Give it its own `port_range` / registry file (or tag sites with `host:`)
3. Point tunnels at the correct host
4. Deploy platform stack on every host that runs WP sites

## Performance checklist

- [ ] Cloudflare caching for static assets (bypass `/wp-admin` and `/wp-login.php`)
- [ ] Redis Object Cache enabled
- [ ] Sensible PHP memory limits
- [ ] Offload media to R2/S3 if uploads grow large
- [ ] Regular DB + file backups ([backups-restore.md](backups-restore.md))

## Capacity planning (rule of thumb)

On a modest VPS/server:

| Footprint | Approx. idle RAM / site |
|-----------|-------------------------|
| WordPress + MariaDB | 150–300 MB |
| + Redis share | amortized |

Always validate with real traffic; WooCommerce and page builders cost more.
