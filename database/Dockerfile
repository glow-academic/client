# database/Dockerfile
FROM postgres:15-alpine AS base

# Install bash for custom entrypoint script
RUN apk add --no-cache bash

# Set working directory
WORKDIR /database

# Create directories
RUN mkdir -p /database/history

# Copy custom entrypoint
COPY custom-entrypoint.sh /custom-entrypoint.sh

RUN chmod +x /custom-entrypoint.sh

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

# Set default environment variables
ENV POSTGRES_USER=myuser
ENV POSTGRES_PASSWORD=mypassword
ENV POSTGRES_DB=mydb
ENV HISTORY_DIR=/database/history

# Health check
HEALTHCHECK --interval=5s --timeout=5s --retries=5 \
  CMD pg_isready -U $POSTGRES_USER -d $POSTGRES_DB

# Use custom entrypoint
ENTRYPOINT ["/custom-entrypoint.sh"]
CMD ["postgres"]