# realtime/Dockerfile
# syntax=docker/dockerfile:1.7
FROM coturn/coturn:4.6

COPY start-turn.sh   /usr/local/bin/start-turn.sh

# Make scripts executable in a single layer
RUN chmod +x /usr/local/bin/start-turn.sh

ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
