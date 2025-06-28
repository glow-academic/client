# realtime/Dockerfile
FROM coturn/coturn:4.6

############################
# • Run the build steps as root
# • Give the script execute permission
############################
USER root
COPY start-turn.sh /usr/local/bin/start-turn.sh
RUN chmod +x /usr/local/bin/start-turn.sh \
 && chown root:root /usr/local/bin/start-turn.sh

############################
# Drop back to the image’s runtime user
############################
USER coturn          # ← the user defined by the base image
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
