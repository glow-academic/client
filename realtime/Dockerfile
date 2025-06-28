FROM coturn/coturn:4.6

# normal COPY
COPY start-turn.sh /usr/local/bin/

# strip CR characters and make it executable for good measure
RUN sed -i 's/\r$//' /usr/local/bin/start-turn.sh \
    && chmod 755 /usr/local/bin/start-turn.sh \
    && chown turnserver:turnserver /usr/local/bin/start-turn.sh

USER turnserver
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
