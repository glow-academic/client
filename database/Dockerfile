# ——— PostgreSQL Base Stage ———
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

# Note: Cypress E2E tests should be run separately against the running database
# This follows best practices of separating build-time and runtime concerns

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

# Copy database initialization files
COPY init/ /database/init/
COPY init.sql /database/init.sql
RUN chmod +x /database/init/agents/generate-agents-sql.sh

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