#!/usr/bin/env bash
set -euo pipefail

# TURN Server Setup Script for Glow Development Environment
# This script helps set up and test a TURN/STUN server for WebRTC

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

############################################
# 1 · helper: discover our LAN interface   #
############################################
get_private_ip() {
  # macOS: ipconfig, Linux: hostname -I
  if command -v ipconfig &>/dev/null; then
    ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1"
  else
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

############################################
#  ✨  Helper: build TURN/STUN URI strings  #
############################################
build_ice_uris() {
  local ip="$1"           # public IP or hostname
  local port="${2:-3478}" # default TURN port

  # TURN – build "turn:<ip>:<port>?transport=udp,tcp"
  local _transports=(udp tcp)
  local _turn_list=()
  for _proto in "${_transports[@]}"; do
    _turn_list+=("turn:${ip}:${port}?transport=${_proto}")
  done
  TURN_URI="$(IFS=,; echo "${_turn_list[*]}")"

  # STUN – single URI is enough
  STUN_URI="stun:${ip}:${port}"
}

# Get public IP for TURN server configuration
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
    public_ip="localhost"
  fi
  
  echo "$public_ip"
}

# Check if port is in use
check_port() {
  local port=$1
  local protocol=${2:-udp}
  
  if [[ "$protocol" == "udp" ]]; then
    lsof -Pi :$port -sUDP:Listen -t >/dev/null 2>&1
  else
    lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
  fi
}

# Test TURN server connectivity
test_turn_server() {
  local host=$1
  local username=$2
  local password=$3
  
  log_info "Testing TURN server connectivity..."
  
  # Create a simple test script
  cat > /tmp/turn_test.js << 'EOF'
const { RTCPeerConnection } = require('wrtc');

const host = process.argv[2];
const username = process.argv[3];
const password = process.argv[4];

const iceServers = [
  { urls: `stun:${host}:3478` },
  { 
    urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`],
    username: username,
    credential: password
  }
];

const pc = new RTCPeerConnection({ iceServers });

pc.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE Candidate:', event.candidate.candidate);
    if (event.candidate.candidate.includes('relay')) {
      console.log('✅ TURN server is working - relay candidate found');
      process.exit(0);
    }
  } else {
    console.log('ICE gathering complete');
    setTimeout(() => {
      console.log('⚠️  No relay candidates found - TURN server may not be working');
      process.exit(1);
    }, 1000);
  }
};

pc.onicegatheringstatechange = () => {
  console.log('ICE gathering state:', pc.iceGatheringState);
};

// Create a data channel to trigger ICE gathering
pc.createDataChannel('test');
pc.createOffer().then(offer => pc.setLocalDescription(offer));

setTimeout(() => {
  console.log('⚠️  Test timeout - TURN server may not be accessible');
  process.exit(1);
}, 10000);
EOF

  # Run the test if Node.js and wrtc are available
  if command -v node &>/dev/null && node -e "require('wrtc')" 2>/dev/null; then
    node /tmp/turn_test.js "$host" "$username" "$password"
  else
    log_warning "Node.js or wrtc module not available, skipping connectivity test"
    log_info "You can test manually by checking if port 3478 is open:"
    log_info "  nc -u $host 3478"
  fi
  
  # Clean up
  rm -f /tmp/turn_test.js
}

# Update .env file with TURN configuration
update_env_file() {
  local env_file
  env_file="$(dirname "$0")/../.env"

  log_info "Updating .env file at $env_file"

  # Create .env if it doesn't exist
  if [[ ! -f "$env_file" ]]; then
      touch "$env_file"
      log_info "Created .env file."
  fi

  # Filter out old TURN settings
  local temp_env
  temp_env=$(mktemp)
  grep -vE "^(TURN_PUBLIC_IP|TURN_REALM|TURN_USERNAME|TURN_PASSWORD|TURN_URI|STUN_URI|# WebRTC/TURN settings)" "$env_file" > "$temp_env"
  cat "$temp_env" > "$env_file"
  rm "$temp_env"

  # Add new TURN/STUN variables
  {
    echo ""
    echo "# WebRTC/TURN settings (generated by realtime/setup.sh)"
    echo "TURN_PUBLIC_IP=\"$TURN_PUBLIC_IP\""
    echo "TURN_REALM=\"$TURN_REALM\""
    echo "TURN_USERNAME=\"$TURN_USERNAME\""
    echo "TURN_PASSWORD=\"$TURN_PASSWORD\""
    echo "TURN_URI=\"$TURN_URI\""
    echo "STUN_URI=\"$STUN_URI\""
  } >> "$env_file"

  log_success ".env file updated."
  log_info "To apply these settings in your current shell, run:"
  log_info "  source \"$env_file\""
}

# Setup TURN server environment variables (copied from run.sh)
setup_turn_env() {
  # Set default values if not already set
  export TURN_PUBLIC_IP="${TURN_PUBLIC_IP:-$(get_public_ip)}"
  export TURN_REALM="${TURN_REALM:-localhost}"
  export TURN_USERNAME="${TURN_USERNAME:-localuser}"
  export TURN_PASSWORD="${TURN_PASSWORD:-localpass}"
  
  build_ice_uris "$TURN_PUBLIC_IP" 3478
  export TURN_URI STUN_URI
  
  log_info "TURN server configuration:"
  log_info "  Public IP: $TURN_PUBLIC_IP"
  log_info "  Realm: $TURN_REALM"
  log_info "  Username: $TURN_USERNAME"
  log_info "  Password: $TURN_PASSWORD"
  log_info "  TURN URI: $TURN_URI"
  log_info "  STUN URI: $STUN_URI"
}

# Main setup function
setup_turn_server() {
  echo -e "${BLUE}🔄 Setting up TURN/STUN server for WebRTC${NC}"
  echo ""
  
  # Setup environment variables
  setup_turn_env
  
  # Update .env file
  update_env_file

  echo ""
  
  # Check if port is already in use
  if check_port 3478 udp; then
    log_warning "Port 3478 (UDP) is already in use"
    if pgrep -f "turnserver\|coturn" >/dev/null; then
      log_success "TURN server appears to be already running"
      return 0
    else
      log_error "Port 3478 is in use by another service"
      return 1
    fi
  fi
  
  # Try Docker first
  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    log_info "Starting TURN server using Docker..."
    
    # Stop existing container
    docker stop glow-realtime 2>/dev/null || true
    docker rm glow-realtime 2>/dev/null || true
    
    # Pull the image
    docker pull coturn/coturn:4.6
    
    # Start container (using environment variables like run.sh)
    docker run -d \
      --name glow-realtime \
      --restart unless-stopped \
      -p 3478:3478/udp \
      -p 3478:3478/tcp \
      -p 49160-49200:49160-49200/udp \
      coturn/coturn:4.6 turnserver \
        --log-file=stdout \
        --lt-cred-mech \
        --no-tls \
        --no-dtls \
        --verbose \
        --listening-port=3478 \
        --min-port=49160 \
        --max-port=49200 \
        --realm="$TURN_REALM" \
        --user="$TURN_USERNAME:$TURN_PASSWORD" \
        --listening-ip="0.0.0.0" \
        --external-ip="$TURN_PUBLIC_IP"
        
    sleep 5
    
    local container_running=false
    for i in {1..10}; do
      if docker ps | grep -q glow-realtime; then
        container_running=true
        break
      fi

      sleep 1
    done
    
    if $container_running; then
      # Additional check: verify the container is actually listening
      sleep 2
      if docker exec glow-realtime netstat -ln 2>/dev/null | grep -q ":3478" || docker logs glow-realtime 2>/dev/null | grep -q "UDP listener opened"; then
        log_success "TURN server started using Docker and is listening on port 3478"
      else
        log_success "TURN server started using Docker (container running)"
      fi
      
      # Show environment variables to set
      echo ""
      echo -e "${YELLOW}📝 Add these to your environment:${NC}"
      echo "export TURN_PUBLIC_IP=\"$TURN_PUBLIC_IP\""
      echo "export TURN_REALM=\"$TURN_REALM\""
      echo "export TURN_USERNAME=\"$TURN_USERNAME\""
      echo "export TURN_PASSWORD=\"$TURN_PASSWORD\""
      echo "export TURN_URI=\"$TURN_URI\""
      echo "export STUN_URI=\"$STUN_URI\""
      echo ""
      
      # Test the server (optional, don't fail if test fails)
      if command -v node &>/dev/null && node -e "require('wrtc')" 2>/dev/null; then
        test_turn_server "$TURN_PUBLIC_IP" "$TURN_USERNAME" "$TURN_PASSWORD" || log_warning "TURN server test failed, but server appears to be running"
      else
        log_info "Skipping TURN server test (Node.js/wrtc not available)"
      fi
      
      return 0
    else
      log_error "Failed to start Docker TURN server"
      log_info "Check Docker logs: docker logs glow-realtime"
      
      # Show container logs for debugging
      if docker ps -a | grep -q glow-realtime; then
        log_info "Container logs:"
        docker logs --tail 10 glow-realtime
      fi
      
      return 1
    fi
  fi
  
  # Try native installation
  log_info "Docker not available, trying native coturn installation..."
  
  if ! command -v turnserver &>/dev/null; then
    log_info "Installing coturn..."
    
    if command -v brew &>/dev/null; then
      brew install coturn
    elif command -v apt-get &>/dev/null; then
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y coturn
    elif command -v yum &>/dev/null; then
      sudo yum install -y coturn
    else
      log_error "Could not install coturn automatically"
      log_info "Please install coturn manually:"
      log_info "  macOS: brew install coturn"
      log_info "  Ubuntu/Debian: sudo apt-get install coturn"
      log_info "  RHEL/CentOS: sudo yum install coturn"
      return 1
    fi
  fi
  
  # Create config file
  local config_file="/tmp/turnserver.conf"
  cat > "$config_file" << EOF
listening-port=3478
external-ip=$TURN_PUBLIC_IP
realm=$TURN_REALM
user=$TURN_USERNAME:$TURN_PASSWORD
lt-cred-mech
log-file=stdout
no-dtls
no-tls
min-port=49160
max-port=49200
verbose
EOF
  
  # Start turnserver
  log_info "Starting native TURN server..."
  turnserver -c "$config_file" &
  local turn_pid=$!
  
  # Wait and check if it started
  sleep 3
  if kill -0 $turn_pid 2>/dev/null; then
    log_success "TURN server started (PID: $turn_pid)"
    
    # Show environment variables
    echo ""
    echo -e "${YELLOW}📝 Add these to your environment:${NC}"
    echo "export TURN_PUBLIC_IP=\"$TURN_PUBLIC_IP\""
    echo "export TURN_REALM=\"$TURN_REALM\""
    echo "export TURN_USERNAME=\"$TURN_USERNAME\""
    echo "export TURN_PASSWORD=\"$TURN_PASSWORD\""
    echo "export TURN_URI=\"$TURN_URI\""
    echo "export STUN_URI=\"$STUN_URI\""
    echo ""
    
    # Test the server (optional, don't fail if test fails)
    if command -v node &>/dev/null && node -e "require('wrtc')" 2>/dev/null; then
      test_turn_server "$TURN_PUBLIC_IP" "$TURN_USERNAME" "$TURN_PASSWORD" || log_warning "TURN server test failed, but server appears to be running"
    else
      log_info "Skipping TURN server test (Node.js/wrtc not available)"
    fi
    
    return 0
  else
    log_error "Failed to start native TURN server"
    rm -f "$config_file"
    return 1
  fi
}

# Show status
show_status() {
  echo -e "${BLUE}📊 TURN Server Status${NC}"
  echo ""
  
  # Check if Docker container is running
  local docker_running=false
  local native_running=false
  
  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    if docker ps --format "table {{.Names}}" 2>/dev/null | grep -q "^glow-realtime$"; then
      docker_running=true
    fi
  fi
  
  if pgrep -f "turnserver\|coturn" >/dev/null 2>&1; then
    native_running=true
  fi
  
  if $docker_running; then
    log_success "Docker TURN server is running (container: glow-realtime)"
    docker logs --tail 5 glow-realtime 2>/dev/null || log_warning "Could not fetch container logs"
  elif $native_running; then
    log_success "Native TURN server is running"
    echo "PIDs: $(pgrep -f 'turnserver\|coturn' | tr '\n' ' ')"
  else
    log_warning "No TURN server found running"
  fi
  
  echo ""
  
  # Show current environment
  log_info "Current environment variables:"
  echo "  TURN_PUBLIC_IP: ${TURN_PUBLIC_IP:-not set}"
  echo "  TURN_REALM: ${TURN_REALM:-not set}"
  echo "  TURN_USERNAME: ${TURN_USERNAME:-not set}"
  echo "  TURN_PASSWORD: ${TURN_PASSWORD:-not set}"
  echo "  TURN_URI: ${TURN_URI:-not set}"
  echo "  STUN_URI: ${STUN_URI:-not set}"
}

# Stop TURN server
stop_turn_server() {
  echo -e "${BLUE}🛑 Stopping TURN server${NC}"
  echo ""
  
  local stopped_something=false
  
  # Stop Docker container
  if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    if docker ps --format "table {{.Names}}" 2>/dev/null | grep -q "^glow-realtime$"; then
      log_info "Stopping Docker TURN server..."
      docker stop glow-realtime 2>/dev/null || log_warning "Failed to stop container"
      docker rm glow-realtime 2>/dev/null || log_warning "Failed to remove container"
      log_success "Docker TURN server stopped"
      stopped_something=true
    fi
  fi
  
  # Stop native processes
  if pgrep -f "turnserver\|coturn" >/dev/null 2>&1; then
    log_info "Stopping native TURN server..."
    pkill -f "turnserver\|coturn" 2>/dev/null || log_warning "Failed to stop native processes"
    log_success "Native TURN server stopped"
    stopped_something=true
  fi
  
  if $stopped_something; then
    log_success "TURN server(s) stopped"
  else
    log_info "No TURN servers were running"
  fi
}

# Main script logic
case "${1:-setup}" in
  setup)
    setup_turn_server
    ;;
  status)
    show_status
    ;;
  stop)
    stop_turn_server
    ;;
  test)
    # Setup environment if not already set
    if [[ -z "${TURN_PUBLIC_IP:-}" ]]; then
      setup_turn_env
    fi
    test_turn_server "$TURN_PUBLIC_IP" "$TURN_USERNAME" "$TURN_PASSWORD"
    ;;
  export-env)
    setup_turn_env >/dev/null # setup variables without printing logs
    echo "export TURN_PUBLIC_IP=\"$TURN_PUBLIC_IP\""
    echo "export TURN_REALM=\"$TURN_REALM\""
    echo "export TURN_USERNAME=\"$TURN_USERNAME\""
    echo "export TURN_PASSWORD=\"$TURN_PASSWORD\""
    echo "export TURN_URI=\"$TURN_URI\""
    echo "export STUN_URI=\"$STUN_URI\""
    ;;
  --help|-h)
    echo "TURN Server Setup Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup       Set up and start TURN server, and update .env file (default)"
    echo "  status      Show current TURN server status"
    echo "  stop        Stop all TURN servers"
    echo "  test        Test TURN server connectivity"
    echo "  export-env  Print export commands for current shell"
    echo "  --help      Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  TURN_PUBLIC_IP   Public IP for TURN server (auto-detected)"
    echo "  TURN_REALM       TURN realm (default: localhost)"
    echo "  TURN_USERNAME    TURN username (default: localuser)"
    echo "  TURN_PASSWORD    TURN password (default: localpass)"
    echo "  TURN_URI         Full TURN URI (auto-generated)"
    echo "  STUN_URI         Full STUN URI (auto-generated)"
    ;;
  *)
    log_error "Unknown command: $1"
    echo "Use '$0 --help' for usage information"
    exit 1
    ;;
esac 