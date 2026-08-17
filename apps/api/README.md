# Life OS API

Self-hosted Fastify/PostgreSQL API for web and native clients.

## Account model

- Every person has an independent login and profile.
- Registration creates a personal household.
- An owner can invite one partner into a couple household.
- Invite links expire after seven days and may be email-bound.
- Each Life OS record has an owner and is explicitly `PRIVATE` or `SHARED`.
- Linking accounts does not expose existing private records.

## Local development

```bash
cp apps/api/.env.example apps/api/.env
pnpm api:dev
```

## Routes

| Route | Purpose |
|---|---|
| `POST /v1/auth/register` | Create user + personal household |
| `POST /v1/auth/login` | Create access/refresh session |
| `POST /v1/auth/refresh` | Rotate refresh token |
| `GET/PATCH /v1/me` | Read/update profile |
| `POST /v1/households/invites` | Create one-use partner invite |
| `POST /v1/households/invites/accept` | Link partner account |
| `PATCH /v1/households/active` | Switch personal/shared household |
| `GET/POST/PATCH/DELETE /v1/items` | Sync private/shared Life OS records |
| `GET /health` | Deployment health check |

## Security defaults

- Scrypt password hashing with per-password salts
- Short-lived signed access tokens
- Rotating opaque refresh tokens stored only as SHA-256 hashes
- Rate-limited authentication and invitation endpoints
- Helmet security headers and explicit CORS allowlist
- Database ownership checks on every item mutation
