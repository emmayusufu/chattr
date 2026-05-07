FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
ENV NODE_ENV=production
ENV PORT=3030
ENV HOST=0.0.0.0
EXPOSE 3030
USER node
CMD ["node", "build/index.js"]
