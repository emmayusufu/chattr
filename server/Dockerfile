FROM node:24-slim AS builder
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    meson \
    ninja-build \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npx tsc

FROM node:24-slim AS prod-deps
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    meson \
    ninja-build \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-slim
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
