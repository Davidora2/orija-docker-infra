# Life OS Production Deployment

The production stack runs:

- Caddy (automatic HTTPS)
- Next.js web app
- Fastify API
- PostgreSQL

## Server requirements

- Ubuntu/Debian server with Docker Engine + Compose plugin
- Either public ports 80/443 **or** a Cloudflare Tunnel origin
- DNS for the Life OS domain (proxied via Cloudflare when using a tunnel)
- SSH access **or** Portainer API access for deployment

## Portainer + Cloudflare Tunnel (recommended on orija.store)

Use `compose.portainer.yml`. It does **not** bind host ports 80/443. Caddy listens
internally and publishes only `8088:80` for the tunnel origin.

1. Create the Portainer stack from this Git repository:
   - Compose path: `compose.portainer.yml`
   - Branch: the branch that contains this file
   - Env: `LIFE_OS_DOMAIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`
2. In Cloudflare Zero Trust → your tunnel → Public Hostname:
   - Hostname: your Life OS domain (e.g. `lifeos.orija.store`)
   - Service: `http://localhost:8088` if cloudflared uses host networking, else
     `http://172.17.0.1:8088`, or join cloudflared to the Docker network `life-os`
     and use `http://caddy:80`
3. Keep SSL/TLS mode **Full** (not Full Strict unless you also terminate TLS on origin).

Health check after the tunnel is live:

```bash
curl -fsS https://<LIFE_OS_DOMAIN>/api/health
```

## First deployment

```bash
cp .env.production.example .env.production
```

Generate secrets rather than using the examples:

```bash
openssl rand -base64 36
openssl rand -base64 48
```

Set `LIFE_OS_DOMAIN`, `POSTGRES_PASSWORD`, and `JWT_SECRET`, then:

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Caddy requests and renews TLS certificates automatically. The API is exposed at
`https://<domain>/api`; the database is not exposed publicly.

## Connect the native app

Build the app with:

```bash
EXPO_PUBLIC_API_URL=https://<domain>/api pnpm --dir apps/mobile export:android
EXPO_PUBLIC_API_URL=https://<domain>/api pnpm --dir apps/mobile export:ios
```

For signed store builds, set the same environment variable in the Expo/EAS build
profile.

## Backups

Create a daily encrypted server backup of the `life-os-postgres` volume. A basic
logical backup command is:

```bash
docker compose --env-file .env.production -f compose.production.yml \
  exec -T postgres pg_dump -U lifeos -d lifeos -Fc > lifeos.dump
```

Store copies off-server and test restoring them before the private beta.
