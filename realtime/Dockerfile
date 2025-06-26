# realtime/Dockerfile
FROM coturn/coturn:4.6

COPY --chmod=755 start-turn.sh /usr/local/bin/start-turn.sh
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]