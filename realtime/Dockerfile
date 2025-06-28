FROM coturn/coturn:4.6

COPY start-turn.sh /usr/local/bin/start-turn.sh

# Switch to root to modify the script
USER root

# 1. Fix line endings (if you haven't done it locally with dos2unix).
# 2. Make the script executable by everyone.
#    Since all users can execute it, we don't need to change its owner.
RUN sed -i 's/\r$//' /usr/local/bin/start-turn.sh \
    && chmod 755 /usr/local/bin/start-turn.sh

# Switch to the turnserver user that the entrypoint will use
USER turnserver

ENTRYPOINT ["/usr/local/bin/start-turn.sh"]