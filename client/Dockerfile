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
# 2️⃣  tester  – Vitest only
############################
FROM deps AS tester
WORKDIR /app
COPY . .

ENV NODE_ENV=test
# Vitest exits with non-zero on failure → build fails
CMD ["yarn", "test"]

############################
# 3️⃣  builder – Next.js
############################
FROM deps AS builder
WORKDIR /app
COPY . .

# ---- build-time env ----
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_PORT
ARG DB_HOST
ARG AUTH_SECRET
ARG AUTH_MICROSOFT_ENTRA_ID_ID
ARG AUTH_MICROSOFT_ENTRA_ID_SECRET
ARG NEXT_PUBLIC_BASE_PATH
ARG NEXT_PUBLIC_CAMPUS
ARG NEXT_PUBLIC_CAMPUS_EMAIL
ARG INTERNAL_API_BASE

ENV \
  DB_USER=$DB_USER \
  DB_PASSWORD=$DB_PASSWORD \
  DB_NAME=$DB_NAME \
  DB_PORT=$DB_PORT \
  DB_HOST=$DB_HOST \
  AUTH_SECRET=$AUTH_SECRET \
  AUTH_MICROSOFT_ENTRA_ID_ID=$AUTH_MICROSOFT_ENTRA_ID_ID \
  AUTH_MICROSOFT_ENTRA_ID_SECRET=$AUTH_MICROSOFT_ENTRA_ID_SECRET \
  NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
  NEXT_PUBLIC_CAMPUS=$NEXT_PUBLIC_CAMPUS \
  NEXT_PUBLIC_CAMPUS_EMAIL=$NEXT_PUBLIC_CAMPUS_EMAIL \
  INTERNAL_API_BASE=$INTERNAL_API_BASE \
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
