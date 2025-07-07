# syntax=docker/dockerfile:1.7
# client/Dockerfile - Optimized multi-stage build

############################################
# 1️⃣  Dependencies (re-run only if lock-file changes)
############################################
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies only once
RUN apk add --no-cache libc6-compat

# Copy package files for dependency installation
COPY package.json yarn.lock ./

# Re-use Yarn's global cache across builds using BuildKit cache mount
RUN --mount=type=cache,id=yarn,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile

############################################
# 2️⃣  Build Stage
############################################
FROM node:20-alpine AS builder
WORKDIR /app

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# ——— build-args for environment variables ———
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_PORT
ARG DB_HOST
ARG AUTH_SECRET
ARG AUTH_MICROSOFT_ENTRA_ID_ID
ARG AUTH_MICROSOFT_ENTRA_ID_SECRET

# Set environment variables for build
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_NAME=$DB_NAME
ENV DB_PORT=$DB_PORT
ENV DB_HOST=$DB_HOST
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_MICROSOFT_ENTRA_ID_ID=$AUTH_MICROSOFT_ENTRA_ID_ID
ENV AUTH_MICROSOFT_ENTRA_ID_SECRET=$AUTH_MICROSOFT_ENTRA_ID_SECRET

# Set build environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run unit tests as part of the build process (COMMENTED OUT FOR NOW)
# Uncomment the lines below when you want to enable testing in the build
# RUN echo "🧪 Running unit tests..." && \
#     yarn test

# Build the application with Next.js cache mount for faster rebuilds
RUN --mount=type=cache,id=nextjs,target=/app/.next/cache \
    echo "🏗️  Building Next.js application..." && \
    yarn build

############################################
# 3️⃣  Production Runtime (minimal image)
############################################
FROM node:20-alpine AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user AND install curl in the same layer
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache curl

# Copy the minimal "standalone" output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose the port
EXPOSE 3000

# Start the application using the standalone server
CMD ["node", "server.js"]
