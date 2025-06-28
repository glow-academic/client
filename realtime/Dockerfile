# realtime/Dockerfile
# syntax=docker/dockerfile:1.7
FROM coturn/coturn:4.6

###############################################################################
# 1️⃣  Become root (the base image sets USER turn, so we must override first)
###############################################################################
USER root

###############################################################################
# 2️⃣  Create a guaranteed non-root account called `turnserver`
#     – if it already exists we just skip the whole block.
###############################################################################
RUN if ! id -u turnserver >/dev/null 2>&1; then \
        addgroup  -S -g 345 turnserver && \
        adduser   -S -u 345 -G turnserver \
                  -h /var/lib/turn -s /sbin/nologin \
                  turnserver ; \
    fi

###############################################################################
# 3️⃣  Copy the wrapper script in one layer - set mode & ownership
###############################################################################
COPY --chmod=755 --chown=turnserver:turnserver \
     start-turn.sh /usr/local/bin/

###############################################################################
# 4️⃣  Drop privileges for runtime
###############################################################################
USER turnserver

ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
