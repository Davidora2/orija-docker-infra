FROM node:22-alpine
WORKDIR /app
COPY packages/shared /app/packages/shared
COPY services/api-gateway/package.json /app/services/api-gateway/package.json
WORKDIR /app/services/api-gateway
RUN npm install --omit=dev
COPY services/api-gateway/src ./src
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
