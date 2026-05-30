# syntax=docker/dockerfile:1.7

############################
# 1️⃣  deps  – install once
############################
FROM oven/bun:1-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
COPY package.json bun.lock* ./

# cache Yarn’s global folder – survives between builds
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

############################
# 2️⃣  builder – Next.js
############################
FROM deps AS builder
WORKDIR /app
COPY . .

# ---- build-time env ----
# Only NEXT_PUBLIC_* vars need to be present at build time (inlined by webpack).
# Server-side vars (AUTH_SECRET, AUTH_KEYCLOAK_ID, etc.) are read from
# process.env at runtime and must NOT be baked into the build.
ARG NEXT_PUBLIC_CAMPUS
ARG APP_PREFIX
ARG NEXT_PUBLIC_APP_PREFIX
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_AUTH_KEYCLOAK_ID
ARG APP_VERSION=dev

ENV \
  AUTH_SECRET=build-placeholder \
  NEXT_PUBLIC_CAMPUS=$NEXT_PUBLIC_CAMPUS \
  APP_PREFIX=$APP_PREFIX \
  NEXT_PUBLIC_APP_PREFIX=$NEXT_PUBLIC_APP_PREFIX \
  NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
  NEXT_PUBLIC_AUTH_KEYCLOAK_ID=$NEXT_PUBLIC_AUTH_KEYCLOAK_ID \
  NEXT_PUBLIC_APP_VERSION=$APP_VERSION \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

# Build with cache for the Next.js compiler
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    bun run build --no-lint

############################
# 4️⃣  runtime – 17 MB 😎
############################
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1


# non-root user (keep wget for Docker healthcheck)
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# copy the standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public         ./public

# Demo/QA spec definitions for `glow record client` — text-only (a few KB).
# The Playwright runtime + Chromium live on the host, not in this image, so
# this adds negligible size and nothing is required at runtime.
COPY --from=builder /app/e2e                  ./e2e
COPY --from=builder /app/playwright.config.ts ./playwright.config.ts

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
