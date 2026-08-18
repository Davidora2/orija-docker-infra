# Managing WordPress accounts

Each hosted website has **its own WordPress user database**. Accounts on site A cannot log into site B.

## Primary admin (created at provision)

Set at provision time:

```bash
./scripts/provision-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --admin-user acmeadmin \
  --admin-email admin@acme.example \
  --admin-password 'optional-custom-pass'
```

If `--admin-password` is omitted, a strong random password is generated into `sites/<slug>/.env` and `credentials.txt`.

| Field | Registry | Secrets file |
|-------|----------|--------------|
| Admin username | yes (`admin_user`) | yes |
| Admin email | yes (`admin_email`) | yes |
| Admin password | **never** | `.env` only |

## Add more users (per site)

Log into that site’s `/wp-admin` → Users → Add New.

Recommended roles:

| Role | Use |
|------|-----|
| Administrator | Site owner / agency lead (limit to 1–2) |
| Editor | Content team |
| Author | Individual writers |
| Shop Manager | WooCommerce (if installed) |

## Reset a forgotten admin password

### Option A — WP Admin email reset

Use “Lost your password” on `/wp-login.php` if outbound email works.

### Option B — WP-CLI on the host

```bash
# Find the wordpress container for the site
docker ps --format '{{.ID}} {{.Names}}' | grep acme

docker exec -u www-data <wordpress_container_id> \
  wp user update acmeadmin --user_pass='NewStrongPasswordHere'
```

Or run a one-off CLI container against the site volume (same pattern as `wp-init` in the compose template).

### Option C — Re-provision password in Portainer env

Changing `WP_ADMIN_PASSWORD` in Portainer **does not** update an already-installed site (wp-init skips). Use WP-CLI or the Users screen.

## Map “accounts” to websites

Keep the registry as the source of truth for *which login belongs where*:

```bash
./scripts/list-sites.sh
```

Example:

```
SLUG       DOMAIN                 PORT   ADMIN         STATUS
acme       acme.orija.store       19101  acmeadmin     deployed
clientb    clientb.orija.store    19102  clientbadmin  deployed
```

For client handoff: create their admin user, demote/remove yours, and rotate DB passwords if they take over the stack.

## Agency / multi-brand pattern

If one agency manages many brands:

1. One `wp-<slug>` stack per brand site
2. Shared agency email as secondary admin on each site (optional)
3. Brand-specific primary admin for the client
4. Registry `notes` field for CRM references

```bash
./scripts/provision-site.sh \
  --slug brandx \
  --domain brandx.orija.store \
  --admin-user brandxowner \
  --notes "Agency: Orija / CRM-4421" \
  --deploy
```

## WordPress Multisite (optional alternative)

Only if you intentionally want **one** WordPress install controlling many subsites under one network admin. That is a different threat model. This platform’s default (isolated stacks) is preferred for separate customers.
