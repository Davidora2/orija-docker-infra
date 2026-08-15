FROM node:22-alpine
WORKDIR /app
COPY packages/shared /app/packages/shared
COPY services/event-processor/package.json /app/services/event-processor/package.json
WORKDIR /app/services/event-processor
RUN npm install --omit=dev
COPY services/event-processor/src ./src
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
