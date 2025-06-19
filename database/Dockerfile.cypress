# syntax=docker/dockerfile:1.7
FROM cypress/browsers:node-22.14.0-chrome-133.0.6943.126-1-ff-135.0.1-edge-133.0.3065.82-1

USER root

# 1) Install lightweight tools in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 2) Create non-root user & cache directories
RUN adduser --disabled-password --gecos "" cypress
USER cypress

# Set environment variables
ENV HOME=/home/cypress \
    CYPRESS_CACHE_FOLDER=/home/cypress/.cache/Cypress

WORKDIR /e2e

# Copy package files first for better caching
COPY package.json yarn.lock* ./

# 3) Use BuildKit cache for node modules and Cypress binary
RUN --mount=type=cache,target=/home/cypress/.cache \
    if [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile; \
    else \
        npm ci; \
    fi \
 && npx cypress install

# Copy Cypress configuration and tests
COPY cypress.config.ts tsconfig.json ./
COPY cypress/ ./cypress/

# Copy wait-for-services script and set permissions
USER root
COPY scripts/wait-for-services.sh ./
RUN chmod +x wait-for-services.sh && chown cypress:cypress wait-for-services.sh
USER cypress

# Skip `cypress verify` (it runs at runtime anyway)
CMD ["npx", "cypress", "run"] 