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

# Main setup function
setup_turn_server() {
  echo -e "${BLUE}🔄 Setting up TURN/STUN server for WebRTC${NC}"
  echo ""
  
  # Get configuration
  local public_ip=$(get_public_ip)
  local realm="${TURN_REALM:-example.com}"
  local username="${TURN_USERNAME:-webrtc}"
  local password="${TURN_PASS:-$(openssl rand -base64 12 2>/dev/null || echo "changeMe")}"
  
  log_info "Configuration:"
  log_info "  Public IP: $public_ip"
  log_info "  Realm: $realm"
  log_info "  Username: $username"
  log_info "  Password: $password"
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
    
    # Start container
    docker run -d \
      --name glow-realtime \
      --restart unless-stopped \
      -p 3478:3478/udp \
      -p 3478:3478/tcp \
      -p 49160-49200:49160-49200/udp \
      coturn/coturn:4.6 \
      --log-file=stdout \
      --no-dtls \
      --no-tls \
      --lt-cred-mech \
      --realm="$realm" \
      --user="$username:$password" \
      --external-ip="$public_ip" \
      --listening-port=3478 \
      --min-port=49160 \
      --max-port=49200 \
      --verbose
    
    # Wait for container to start
    sleep 5
    
    if docker ps | grep -q glow-realtime; then
      log_success "TURN server started using Docker"
      
      # Export environment variables
      export TURN_PUBLIC_IP="$public_ip"
      export TURN_REALM="$realm"
      export TURN_USERNAME="$username"
      export TURN_PASS="$password"
      
      # Show environment variables to set
      echo ""
      echo -e "${YELLOW}📝 Add these to your environment:${NC}"
      echo "export TURN_PUBLIC_IP=\"$public_ip\""
      echo "export TURN_REALM=\"$realm\""
      echo "export TURN_USERNAME=\"$username\""
      echo "export TURN_PASS=\"$password\""
      echo ""
      
      # Test the server
      test_turn_server "$public_ip" "$username" "$password"
      
      return 0
    else
      log_error "Failed to start Docker TURN server"
      log_info "Check Docker logs: docker logs glow-realtime"
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
external-ip=$public_ip
realm=$realm
user=$username:$password
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
    
    # Export environment variables
    export TURN_PUBLIC_IP="$public_ip"
    export TURN_REALM="$realm"
    export TURN_USERNAME="$username"
    export TURN_PASS="$password"
    
    # Show environment variables
    echo ""
    echo -e "${YELLOW}📝 Add these to your environment:${NC}"
    echo "export TURN_PUBLIC_IP=\"$public_ip\""
    echo "export TURN_REALM=\"$realm\""
    echo "export TURN_USERNAME=\"$username\""
    echo "export TURN_PASS=\"$password\""
    echo ""
    
    # Test the server
    test_turn_server "$public_ip" "$username" "$password"
    
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
  if docker ps 2>/dev/null | grep -q glow-realtime; then
    log_success "Docker TURN server is running (container: glow-realtime)"
    docker logs --tail 5 glow-realtime
  elif pgrep -f "turnserver\|coturn" >/dev/null; then
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
  echo "  TURN_PASS: ${TURN_PASS:-not set}"
}

# Stop TURN server
stop_turn_server() {
  echo -e "${BLUE}🛑 Stopping TURN server${NC}"
  echo ""
  
  # Stop Docker container
  if docker ps 2>/dev/null | grep -q glow-realtime; then
    log_info "Stopping Docker TURN server..."
    docker stop glow-realtime
    docker rm glow-realtime
    log_success "Docker TURN server stopped"
  fi
  
  # Stop native processes
  if pgrep -f "turnserver\|coturn" >/dev/null; then
    log_info "Stopping native TURN server..."
    pkill -f "turnserver\|coturn"
    log_success "Native TURN server stopped"
  fi
  
  if ! pgrep -f "turnserver\|coturn" >/dev/null && ! docker ps 2>/dev/null | grep -q glow-realtime; then
    log_success "All TURN servers stopped"
  else
    log_warning "Some TURN processes may still be running"
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
    public_ip="${TURN_PUBLIC_IP:-$(get_public_ip)}"
    username="${TURN_USERNAME:-webrtc}"
    password="${TURN_PASS:-changeMe}"
    test_turn_server "$public_ip" "$username" "$password"
    ;;
  --help|-h)
    echo "TURN Server Setup Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup    Set up and start TURN server (default)"
    echo "  status   Show current TURN server status"
    echo "  stop     Stop all TURN servers"
    echo "  test     Test TURN server connectivity"
    echo "  --help   Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  TURN_PUBLIC_IP   Public IP for TURN server (auto-detected)"
    echo "  TURN_REALM       TURN realm (default: example.com)"
    echo "  TURN_USERNAME    TURN username (default: webrtc)"
    echo "  TURN_PASS        TURN password (auto-generated)"
    ;;
  *)
    log_error "Unknown command: $1"
    echo "Use '$0 --help' for usage information"
    exit 1
    ;;
esac 