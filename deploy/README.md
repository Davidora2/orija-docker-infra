# Life OS Production Deployment

The production stack runs:

- Caddy (automatic HTTPS)
- Next.js web app
- Fastify API
- PostgreSQL

## Server requirements

- Ubuntu/Debian server with Docker Engine + Compose plugin
- Ports 80 and 443 open
- DNS `A`/`AAAA` record for the Life OS domain pointing to the server
- SSH access for deployment

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
