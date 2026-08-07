FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/life-os/package.json apps/life-os/package.json
RUN pnpm install --frozen-lockfile --filter life-os...

COPY apps/life-os apps/life-os
RUN pnpm --filter life-os build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/life-os/.next/standalone ./
COPY --from=builder /app/apps/life-os/.next/static ./apps/life-os/.next/static

EXPOSE 3000
CMD ["node", "apps/life-os/server.js"]
