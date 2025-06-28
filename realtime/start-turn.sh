#!/bin/sh
set -e

PRIVATE_IP=$(ip -4 addr show eth0 | awk '/inet /{print $2}' | cut -d/ -f1)
echo "⏩ Detected container LAN IP: ${PRIVATE_IP}"

exec turnserver \
  --no-dtls --no-tls --lt-cred-mech \
  --realm="${TURN_REALM:-localhost}" \
  --user="${TURN_USERNAME:-localuser}:${TURN_PASSWORD:-localpass}" \
  --external-ip="${TURN_PUBLIC_IP}/${PRIVATE_IP}" \
  --listening-port=3478 \
  --min-port=49160 --max-port=49200 \
  --fingerprint --mobility --log-file=stdout --verbose
