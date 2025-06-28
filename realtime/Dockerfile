FROM coturn/coturn:4.6

# Copy the script into the container
COPY start-turn.sh /usr/local/bin/start-turn.sh

# --- FIX STARTS HERE ---
# Switch to the root user to be able to change file permissions
USER root
# --- FIX ENDS HERE ---

# Now, run the permission-related commands as root
RUN sed -i 's/\r$//' /usr/local/bin/start-turn.sh \
    && chmod 755 /usr/local/bin/start-turn.sh \
    && chown turnserver:turnserver /usr/local/bin/start-turn.sh

# Switch back to the non-privileged turnserver user for security
USER turnserver

# Set the entrypoint to run the script
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]