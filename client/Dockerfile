# client/Dockerfile

# Use a more recent Node image with Yarn pre-installed
FROM node:20-alpine AS base
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# ——— Testing Stage ———
FROM base AS test
ENV NODE_ENV=test

# ——— build-args for database connection ———
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_PORT
ARG DB_HOST

# Set environment variables for testing
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_NAME=$DB_NAME
ENV DB_PORT=$DB_PORT
ENV DB_HOST=$DB_HOST

# Run unit tests
RUN echo "🧪 Running client unit tests..." && \
    yarn test

# Run type checking
RUN echo "🔍 Running TypeScript type checking..." && \
    npx tsc --noEmit

# Run linting
RUN echo "🔧 Running ESLint..." && \
    yarn lint

# ——— Migration Stage ———
FROM base AS migration
ENV NODE_ENV=development

# ——— build-args for database connection ———
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_PORT
ARG DB_HOST

# Set environment variables for migration
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_NAME=$DB_NAME
ENV DB_PORT=$DB_PORT
ENV DB_HOST=$DB_HOST

# Create migrations directory
RUN mkdir -p /app/migrations

# Default command for migration generation
CMD ["npx", "drizzle-kit", "generate"]

# ——— Production Build Stage ———
FROM base AS build

# ——— build-args come after base setup ———
ARG NEXT_PUBLIC_API_URL
ARG DB_USER
ARG DB_PASSWORD
ARG DB_NAME
ARG DB_PORT
ARG DB_HOST
ARG AUTH_SECRET
ARG AUTH_MICROSOFT_ENTRA_ID_ID
ARG AUTH_MICROSOFT_ENTRA_ID_SECRET

# Set environment variables
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV DB_USER=$DB_USER
ENV DB_PASSWORD=$DB_PASSWORD
ENV DB_NAME=$DB_NAME
ENV DB_PORT=$DB_PORT
ENV DB_HOST=$DB_HOST
ENV AUTH_SECRET=$AUTH_SECRET
ENV AUTH_MICROSOFT_ENTRA_ID_ID=$AUTH_MICROSOFT_ENTRA_ID_ID
ENV AUTH_MICROSOFT_ENTRA_ID_SECRET=$AUTH_MICROSOFT_ENTRA_ID_SECRET

# Set additional environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN echo "🏗️  Building Next.js application..." && \
    yarn build

# ——— Production Runtime Stage ———
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy built application from build stage
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle

# Copy necessary files for runtime
COPY next.config.js ./
COPY drizzle.config.ts ./

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose the port
EXPOSE 3000

# Start the application with drizzle-kit pull first
CMD ["sh", "-c", "npx drizzle-kit pull && yarn start"]
