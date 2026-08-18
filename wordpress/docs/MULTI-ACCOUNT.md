# Multi-account management

This platform treats an **account** as the owner of one or more WordPress websites. Accounts map to Portainer users/teams so each client only sees their stacks.

## Concepts

| Term | Meaning |
|------|---------|
| Account | Logical owner (`alice`, `bob`, agency name) in `registry.yaml` |
| Site | One domain + one `wp-<slug>` stack + one WP install |
| Portainer user | Human login that should only manage that account’s stacks |
| WP admin | Application login inside WordPress (per site, not shared) |

```
Account (alice)
 ├── Site acme.orija.store     → stack wp-acme     → WP admin: alice-acme
 └── Site blooms.orija.store   → stack wp-blooms   → WP admin: alice-blooms

Account (bob)
 └── Site studio.orija.store   → stack wp-studio   → WP admin: bob-studio
```

## Registry

`wordpress/sites/registry.yaml` tracks ownership:

```yaml
accounts:
  - id: alice
    display_name: Alice Agency
    portainer_user: alice
    notes: Client websites

sites:
  - slug: acme
    domain: acme.orija.store
    owner_account: alice
    stack_name: wp-acme
```

`new-site.sh --owner alice` attaches the site to that account (and auto-creates the account entry if missing).

## Portainer RBAC setup (recommended)

Do this once as Portainer admin:

1. **Users → Add user** for each account operator (e.g. `alice`, `bob`)
2. **Teams → Add team** (optional): `team-alice`, add user `alice`
3. When creating stacks for that account, set **Access control** to the user/team (not Administrators-only)
4. Non-admin users only see stacks they can access — they cannot open another client’s WordPress DB volume or env vars

Label every container with `com.orija.owner=<account>` (already set by the template) for auditing in Portainer / Docker.

### What each role manages

| Role | Portainer | WordPress |
|------|-----------|-----------|
| Platform admin | `wp-platform` + all site stacks | Emergency access only |
| Account operator | Only their `wp-*` stacks | WP admins for their sites |
| Site content editor | No Portainer access | WP Editor/Author roles inside that site |

## Creating WP users per account/site

WordPress application users are **not** Portainer users.

1. After deploy, visit `https://<domain>/wp-admin/install.php`
2. Create the primary admin for that site (store password in your password manager)
3. Inside WP → Users → Add: editors, authors as needed
4. Never reuse the same WP admin password across client sites

Optional later: WP-CLI one-shot user create via `docker exec` (see OPERATIONS.md).

## Onboarding checklist (new client account)

1. Create Portainer user/team for the account
2. `./wordpress/scripts/new-site.sh --slug … --domain … --owner <account>`
3. `./wordpress/scripts/deploy-site.sh --slug …`
4. Add Cloudflare Tunnel hostname → `http://localhost:18100`
5. Client completes WP install (or you set admin and hand off credentials securely)
6. Restrict Portainer stack access to that user/team
7. Confirm `list-sites.sh` shows correct `owner_account`

## Offboarding checklist

1. Export content (WP Tools → Export) and download uploads if needed
2. Portainer → delete stack `wp-<slug>` (decide whether to remove volumes)
3. Remove Cloudflare Tunnel hostname / DNS
4. `./wordpress/scripts/remove-site.sh --slug <slug> --yes`
5. Disable Portainer user if they have no remaining sites

## Security notes

- Site `.env` / `CREDENTIALS.txt` must never be committed (gitignored)
- DB network is `internal: true` — MariaDB is not reachable from other sites
- Traefik only exposes WordPress on `wp-public`, not the database
- Prefer unique `OWNER_ACCOUNT` labels even if one human manages many clients (use agency + client ids)
