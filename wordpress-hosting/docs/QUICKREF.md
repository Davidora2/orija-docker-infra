# Operator quick reference

```bash
# One-time platform
export PORTAINER_API_TOKEN=ptr_…
./scripts/deploy-platform.sh

# New website + its own WP admin account
./scripts/provision-site.sh \
  --slug clientb \
  --domain clientb.orija.store \
  --title "Client B" \
  --admin-user clientbadmin \
  --admin-email ops@clientb.example \
  --deploy

# Inventory
./scripts/list-sites.sh
./scripts/list-sites.sh --portainer

# Tunnel:  <domain> → http://localhost:<host_port from list>

# Backup (on Docker host)
./scripts/backup-site.sh clientb

# Remove inventory (+ optional Portainer stack; volumes kept)
./scripts/remove-site.sh clientb --delete-stack
```

Passwords: `sites/<slug>/credentials.txt` then password manager — never commit.
