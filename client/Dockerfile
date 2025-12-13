# syntax=docker/dockerfile:1.7

############################
# 1️⃣  deps  – install once
############################
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock ./

# cache Yarn’s global folder – survives between builds
RUN --mount=type=cache,id=yarn,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile

############################
# 2️⃣  builder – Next.js
############################
FROM deps AS builder
WORKDIR /app
COPY . .

# ---- build-time env ----
ARG AUTH_SECRET
ARG AUTH_MICROSOFT_ENTRA_ID_ID
ARG AUTH_MICROSOFT_ENTRA_ID_SECRET
ARG NEXT_PUBLIC_CAMPUS
ARG INTERNAL_API_BASE
ARG APP_PREFIX
ARG NEXT_PUBLIC_APP_PREFIX
ARG KEYCLOAK_PUBLIC_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG AUTH_KEYCLOAK_ID
ARG NEXT_PUBLIC_AUTH_KEYCLOAK_ID

ENV \
  AUTH_SECRET=$AUTH_SECRET \
  AUTH_MICROSOFT_ENTRA_ID_ID=$AUTH_MICROSOFT_ENTRA_ID_ID \
  AUTH_MICROSOFT_ENTRA_ID_SECRET=$AUTH_MICROSOFT_ENTRA_ID_SECRET \
  NEXT_PUBLIC_CAMPUS=$NEXT_PUBLIC_CAMPUS \
  INTERNAL_API_BASE=$INTERNAL_API_BASE \
  APP_PREFIX=$APP_PREFIX \
  NEXT_PUBLIC_APP_PREFIX=$NEXT_PUBLIC_APP_PREFIX \
  KEYCLOAK_PUBLIC_URL=$KEYCLOAK_PUBLIC_URL \
  NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
  KEYCLOAK_REALM=$KEYCLOAK_REALM \
  NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
  AUTH_KEYCLOAK_ID=$AUTH_KEYCLOAK_ID \
  NEXT_PUBLIC_AUTH_KEYCLOAK_ID=$NEXT_PUBLIC_AUTH_KEYCLOAK_ID \
  NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

# Build with cache for the Next.js compiler
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    yarn build

############################
# 4️⃣  runtime – 17 MB 😎
############################
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1


# minimal utilities + non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && \
    apk add --no-cache curl

# copy the standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public         ./public

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
