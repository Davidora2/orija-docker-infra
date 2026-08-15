FROM node:22-alpine
WORKDIR /app/services/dashboard
COPY services/dashboard/package.json ./
RUN npm install --omit=dev
COPY services/dashboard/src ./src
COPY services/dashboard/public ./public
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
