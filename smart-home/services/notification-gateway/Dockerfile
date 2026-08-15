FROM node:22-alpine
WORKDIR /app
COPY packages/shared /app/packages/shared
COPY services/notification-gateway/package.json /app/services/notification-gateway/package.json
WORKDIR /app/services/notification-gateway
RUN npm install --omit=dev
COPY services/notification-gateway/src ./src
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
