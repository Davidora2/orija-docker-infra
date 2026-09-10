FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p /app/data /data/uploads
ENV NODE_ENV=production
EXPOSE 3847
CMD ["node", "src/server.js"]
