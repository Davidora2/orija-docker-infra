FROM node:22-alpine
WORKDIR /app
COPY packages/shared /app/packages/shared
COPY services/ring-bridge/package.json /app/services/ring-bridge/package.json
WORKDIR /app/services/ring-bridge
RUN npm install --omit=dev
COPY services/ring-bridge/src ./src
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
