# database/Dockerfile
FROM postgres:15-alpine AS base

# Install additional tools for testing and migration handling
RUN apk add --no-cache \
    bash \
    curl \
    nodejs \
    npm \
    && npm install -g yarn

# Set working directory
WORKDIR /database

# Copy database files
COPY init.sql /init.sql
COPY init/ /init/
COPY start.sh /start.sh
COPY package.json /database/package.json

# Create directories
RUN mkdir -p /database/history /database/migrations

# Copy custom entrypoint that integrates with migration system
COPY custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh /start.sh

# Install database dependencies (for testing tools)
RUN cd /database && yarn install --frozen-lockfile

# ——— Cypress Testing Stage ———
FROM cypress/included:13.6.0 AS cypress-test

WORKDIR /database

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy Cypress configuration and tests
COPY cypress.config.ts ./
COPY cypress/ ./cypress/

# Set up environment for Cypress
ENV CI=1
ENV CYPRESS_CACHE_FOLDER=/root/.cache/Cypress

# Run Cypress tests
RUN echo "🧪 Running database E2E tests..." && \
    yarn test:cypress

# ——— Production Stage ———
FROM base AS production

# Set environment variables
ENV POSTGRES_USER=myuser
ENV POSTGRES_PASSWORD=mypassword
ENV POSTGRES_DB=mydb
ENV INIT_SQL=init.sql
ENV INIT_DIR=init
ENV HISTORY_DIR=/database/history
ENV MIGRATIONS_DIR=/database/migrations

# Health check
HEALTHCHECK --interval=5s --timeout=5s --retries=5 \
  CMD pg_isready -U $POSTGRES_USER -d $POSTGRES_DB

# Use custom entrypoint
ENTRYPOINT ["/custom-entrypoint.sh"]
CMD ["postgres"]