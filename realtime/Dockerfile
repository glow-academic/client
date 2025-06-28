# realtime/Dockerfile
FROM coturn/coturn:4.6

COPY start-turn.sh /usr/local/bin/start-turn.sh
RUN chmod 755 /usr/local/bin/start-turn.sh   # <= legacy-builder friendly

ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
