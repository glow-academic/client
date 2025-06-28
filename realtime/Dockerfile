FROM coturn/coturn:4.6

# Install bash only if needed
# RUN apk add --no-cache bash

COPY start-turn.sh /usr/local/bin/start-turn.sh

RUN sed -i 's/\r$//' /usr/local/bin/start-turn.sh \
    && chmod 755 /usr/local/bin/start-turn.sh \
    && chown turnserver:turnserver /usr/local/bin/start-turn.sh

USER turnserver
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
