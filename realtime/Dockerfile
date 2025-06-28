# realtime/Dockerfile
# syntax=docker/dockerfile:1.7
FROM coturn/coturn:4.6

###############################################################################
# 1️⃣  Become root – the upstream image sets `USER turn`, so override first
###############################################################################
USER root

###############################################################################
# 2️⃣  Create a dedicated system user *iff* it is not already present
###############################################################################
RUN set -eux; \
    if ! id -u turnserver >/dev/null 2>&1; then \
        addgroup  --system --gid 345 turnserver && \
        adduser   --system --uid 345 --gid 345 \
                  --home /var/lib/turn \
                  --shell /usr/sbin/nologin \
                  --disabled-password --disabled-login \
                  turnserver ; \
    fi

###############################################################################
# 3️⃣  Copy the wrapper script with correct mode & ownership in *one* layer
###############################################################################
COPY --chmod=755 --chown=turnserver:turnserver \
     start-turn.sh /usr/local/bin/

###############################################################################
# 4️⃣  Drop privileges back to the unprivileged account
###############################################################################
USER turnserver

ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
