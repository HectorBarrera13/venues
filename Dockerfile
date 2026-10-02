# syntax=docker/dockerfile:1

# ---------- deps ----------
# Dependency layer: only manifests, so npm ci is cached until deps actually change.
FROM node:22.14.0-alpine AS deps

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci && npm run db:generate

# ---------- dev ----------
# Hot-reload target used by compose.yaml: source is bind-mounted at /app.
FROM node:22.14.0-alpine AS dev

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- prod ----------
# Compiled service, no dev dependencies. Consumed by release.yml.
FROM node:22.14.0-alpine AS prod

RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm run db:generate

COPY tsconfig.json tsconfig.tests.json ./
COPY src ./src
COPY shared ./shared
COPY scripts ./scripts
RUN npm run build

USER node

EXPOSE 3000
CMD ["node", "dist/src/server.js"]