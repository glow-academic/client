# realtime/Dockerfile
# syntax=docker/dockerfile:1.7
FROM coturn/coturn:4.6

# -------------------------------------------------------------------
# 1. Ensure a non-root account called `turnserver` exists
# -------------------------------------------------------------------
# If it’s already there this does nothing; if not, we create it.
RUN if ! id -u turnserver >/dev/null 2>&1; then \
        addgroup  --system --gid 345 turnserver && \
        adduser   --system --uid 345 --gid 345 \
                  --home /var/lib/turn --shell /sbin/nologin \
                  turnserver ; \
    fi

# -------------------------------------------------------------------
# 2. Copy the wrapper script with correct ownership & mode
#    (BuildKit makes this a single layer)
# -------------------------------------------------------------------
COPY --chmod=755 --chown=turnserver:turnserver \
     start-turn.sh /usr/local/bin/

# -------------------------------------------------------------------
# 3. Drop privileges for runtime
# -------------------------------------------------------------------
USER turnserver

ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
