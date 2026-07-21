# Portainer stacks for the Pinterest × Shopify pin agent

## Which YAML to use

| File | Stack name suggestion | Purpose |
|------|------------------------|---------|
| `pin-agent-once.stack.yml` | `pin-agent-once` | Single dry-run cycle, then exits (best first test) |
| `pin-agent-sandbox.stack.yml` | `pin-agent-sandbox` | Always-on sandbox scheduler (`dry_run`) |
| `pin-agent-prod.stack.yml` | `pin-agent-prod` | Live posting every ~2 hours |
| `pin-agent-sandbox.image.stack.yml` | `pin-agent-sandbox` | Same as sandbox, but paste into Web editor (needs pre-built image) |
| `pin-agent-prod.image.stack.yml` | `pin-agent-prod` | Same as prod, Web-editor / pre-built image |

## Deploy from Git (recommended)

1. Portainer → **Stacks** → **Add stack**
2. Choose **Repository**
3. Repo URL: your `orija-docker-infra` repo
4. Compose path:
   - first test: `portainer/pin-agent-once.stack.yml`
   - then: `portainer/pin-agent-sandbox.stack.yml`
5. Fill env placeholders (Shopify token, etc.) in the YAML or Portainer env UI
6. Deploy

## Deploy from Web editor (paste YAML)

1. On the Portainer host, build the image once:

```bash
cd /path/to/orija-docker-infra
docker build -t orija/pinterest-pin-agent:sandbox ./services/pinterest-pin-agent
docker tag orija/pinterest-pin-agent:sandbox orija/pinterest-pin-agent:prod
```

2. Portainer → **Stacks** → **Add stack** → **Web editor**
3. Paste `pin-agent-sandbox.image.stack.yml` (or prod)
4. Replace `shpat_xxxxxxxx` / Pinterest fields
5. Deploy

## How to verify in Portainer

### One-shot test (`pin-agent-once`)
1. Deploy stack
2. Open container **Logs** — should show selected product + `Dry run — draft saved`
3. **Volumes** → `pin-agent-once-data` → browse `/drafts/` for `.json` + `.jpg`

### Sandbox scheduler
1. Deploy `pin-agent-sandbox`
2. Container → **Console**:
   ```bash
   python -m pin_agent once
   ```
3. Check `/data/drafts` on volume `pin-agent-sandbox-data`

### Go live
Only after drafts look right:
1. Deploy `pin-agent-prod` (separate stack — keep sandbox)
2. Confirm `PIN_AGENT_MODE=live` and real `PINTEREST_BOARD_ID`
3. Watch **Logs** for `Posted Pinterest pin id=...`

## Security tip

Prefer Portainer **stack environment variables** / secrets over committing real tokens into the YAML files in git.
