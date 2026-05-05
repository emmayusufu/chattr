FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ linux-headers
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npx tsc

FROM node:20-alpine AS prod-deps
RUN apk add --no-cache python3 make g++ linux-headers
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
