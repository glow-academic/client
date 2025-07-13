# syntax=docker/dockerfile:1.7
FROM cypress/browsers:node-22.14.0-chrome-133.0.6943.126-1-ff-135.0.1-edge-133.0.3065.82-1

# 1. system tools --------------------------------------------------------------
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends curl postgresql-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /e2e
ENV \
  CYPRESS_CACHE_FOLDER=/cypress-cache \
  CYPRESS_launchOptions='{"args":["--no-sandbox","--disable-dev-shm-usage"]}' \
  NPM_CONFIG_UNSAFE_PERM=true

# 2. JS dependencies -----------------------------------------------------------
COPY package.json yarn.lock* package-lock.json* ./

RUN if [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile ; \
    elif [ -f package-lock.json ]; then \
      npm ci ; \
    else \
      npm install ; \
    fi \
 && npx cypress install          # <── no --unsafe-perm here

# 3. tests & helper ------------------------------------------------------------
COPY cypress.config.ts tsconfig.json ./
COPY cypress/               ./cypress/
COPY wait-for-services.sh   /usr/local/bin/
RUN chmod 755 /usr/local/bin/wait-for-services.sh

ENTRYPOINT ["wait-for-services.sh"]
CMD ["http://client:3000", "http://server:8000/health"]
