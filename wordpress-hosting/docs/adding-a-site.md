# Adding a WordPress site

End-to-end checklist to host a new website with its own WordPress account.

## Prerequisites

- [ ] Platform stack deployed once: `./scripts/deploy-platform.sh`
- [ ] `PORTAINER_API_TOKEN` available in your shell / Cloud Agent secrets
- [ ] Ability to create a Cloudflare Tunnel hostname (or equivalent)
- [ ] This branch pushed to GitHub (Portainer pulls compose from the repo)

## 1. Provision

```bash
cd wordpress-hosting

./scripts/provision-site.sh \
  --slug acme \
  --domain acme.orija.store \
  --title "Acme Marketing" \
  --admin-user acmeadmin \
  --admin-email admin@acme.example \
  --deploy
```

Without `--deploy`, only local files + registry are written; then run:

```bash
./scripts/deploy-site.sh acme
```

### What gets created

| Artifact | Location |
|----------|----------|
| Secrets | `sites/acme/.env` (gitignored) |
| One-time creds sheet | `sites/acme/credentials.txt` |
| Inventory row | `sites/registry.yaml` |
| Portainer stack | `wp-acme` |

## 2. Map the tunnel

```bash
./scripts/list-sites.sh
```

Note `HOST_PORT` (e.g. `19101`). In Cloudflare Zero Trust → Tunnel → Public hostname:

| Field | Value |
|-------|-------|
| Hostname | `acme.orija.store` |
| Service | `http://localhost:19101` |

Wait for DNS to propagate.

## 3. First login

1. Open `https://acme.orija.store/wp-admin`
2. Sign in with the username/password from `credentials.txt`
3. Store credentials in your password manager
4. Delete `sites/acme/credentials.txt` from disk

The `wp-init` container creates the admin user automatically. If login fails, check Portainer logs for `wp-init` and `wordpress`.

## 4. Post-install hardening (recommended)

Inside WP Admin:

1. Install / confirm **Redis Object Cache** (wp-init tries this)
2. Install a security plugin (e.g. Wordfence / Solid Security) if policy requires
3. Set timezone, permalinks (already `/%postname%/`), and a real tagline
4. Create additional editors/authors as needed — see [managing-accounts.md](managing-accounts.md)
5. Turn on automatic plugin/theme updates if appropriate

## 5. Commit registry (optional)

`sites/registry.yaml` is safe to commit (no passwords). Per-site `.env` files must stay local or in a secrets store.

```bash
git add wordpress-hosting/sites/registry.yaml
git commit -m "Register WordPress site acme"
```

## Multiple accounts → multiple sites

| Client / brand | Slug | Domain | WP admin user |
|----------------|------|--------|---------------|
| Acme | `acme` | acme.orija.store | `acmeadmin` |
| Client B | `clientb` | clientb.orija.store | `clientbadmin` |

Repeat provision once per row. Accounts never share a database.

## Local dry-run (no Portainer)

```bash
./scripts/deploy-platform.sh local
./scripts/provision-site.sh --slug demo --domain localhost --host-port 19150
./scripts/deploy-site.sh demo --local
# Browse http://127.0.0.1:19150
```

Note: `WP_HOME`/`SITEURL` use `https://DOMAIN`. For pure local HTTP testing, temporarily adjust env or use a tunnel to localhost.
