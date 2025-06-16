# database/Dockerfile
FROM postgres:15-alpine AS base

# Install bash and Node.js for custom entrypoint and testing
RUN apk add --no-cache bash nodejs npm && \
    npm install -g yarn

# Set working directory
WORKDIR /database

# Create directories
RUN mkdir -p /database/history

# Copy package files and install dependencies
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

# Copy Cypress configuration and tests
COPY cypress.config.ts ./
COPY cypress/ ./cypress/

# Copy custom entrypoint
COPY custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh

# Run Cypress E2E tests as part of the build
RUN echo "🧪 Running database E2E tests..." && \
    CI=1 CYPRESS_CACHE_FOLDER=/root/.cache/Cypress yarn test:cypress

# ——— Production Stage ———
FROM postgres:15-alpine AS production

# Install only bash for custom entrypoint script
RUN apk add --no-cache bash

# Set working directory
WORKDIR /database

# Create directories
RUN mkdir -p /database/history

# Copy custom entrypoint from base stage
COPY --from=base /custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh

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