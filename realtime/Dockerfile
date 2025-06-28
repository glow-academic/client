FROM coturn/coturn:4.6

COPY --chmod=755 --chown=turnserver:turnserver \
      start-turn.sh /usr/local/bin/

USER turnserver                  # ✅ this user is present
ENTRYPOINT ["/usr/local/bin/start-turn.sh"]
