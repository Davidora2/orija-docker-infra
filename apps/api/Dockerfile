FROM node:22-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter life-os-api...

COPY apps/api apps/api
RUN pnpm --filter life-os-api build

ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 4000

CMD ["node", "dist/server.js"]
