FROM coturn/coturn:4.6

# Copy the script into the container
COPY start-turn.sh /usr/local/bin/start-turn.sh

# Switch to the root user to be able to change file permissions
USER root

# Correctly set permissions and ownership
RUN sed -i 's/\r$//' /usr/local/bin/start-turn.sh \
    && chmod 755 /usr/local/bin/start-turn.sh \
    && chown turnserver /usr/local/bin/start-turn.sh # <--- MODIFIED THIS LINE

# Switch back to the non-privileged turnserver user for security
USER turnserver

# Set the entrypoint to run the script
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]