FROM coturn/coturn:4.6
COPY --chmod=755 --chown=turnserver:turnserver start-turn.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]