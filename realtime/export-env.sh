#!/usr/bin/env bash

# Export environment variables for TURN server configuration
# Source this file with: source realtime/export-env.sh

# Get public IP (same logic as setup.sh)
get_public_ip() {
  local public_ip=""
  
  # Try multiple methods to get public IP
  if command -v curl &>/dev/null; then
    public_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ipinfo.io/ip 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null)
  fi
  
  if [[ -z "$public_ip" ]] && command -v wget &>/dev/null; then
    public_ip=$(wget -qO- --timeout=5 ifconfig.me 2>/dev/null || wget -qO- --timeout=5 ipinfo.io/ip 2>/dev/null)
  fi
  
  if [[ -z "$public_ip" ]] && command -v dig &>/dev/null; then
    public_ip=$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null | head -n1)
  fi
  
  # Fallback to localhost for local development
  if [[ -z "$public_ip" ]] || [[ ! "$public_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    public_ip="127.0.0.1"
  fi
  
  echo "$public_ip"
}

# Set environment variables
PUBLIC_IP=$(get_public_ip)

export TURN_PUBLIC_IP="$PUBLIC_IP"
export TURN_REALM="${TURN_REALM:-localhost}"
export TURN_USERNAME="${TURN_USERNAME:-localuser}"
export TURN_PASSWORD="${TURN_PASSWORD:-localpass}"
export TURN_URI="turn:${PUBLIC_IP}:3478?transport=udp"
export STUN_URI="stun:${PUBLIC_IP}:3478"

echo "🔗 WebRTC Environment Variables Set:"
echo "  TURN_PUBLIC_IP: $TURN_PUBLIC_IP"
echo "  TURN_REALM: $TURN_REALM"
echo "  TURN_USERNAME: $TURN_USERNAME"
echo "  TURN_PASSWORD: $TURN_PASSWORD"
echo "  TURN_URI: $TURN_URI"
echo "  STUN_URI: $STUN_URI"
echo ""
echo "💡 To use these variables in your terminal session:"
echo "  source realtime/export-env.sh" 