FROM coturn/coturn:4.6
COPY --chmod=755 --chown=root:root start-turn.sh /usr/local/bin/
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]