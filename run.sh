#!/usr/bin/env bash
set -euo pipefail

# Glow Development Environment Startup Script
# 
# This script handles PostgreSQL installation and startup across different environments:
# - macOS (via Homebrew)
# - Linux with systemd (Ubuntu/Debian/RHEL with systemd)
# - Linux without systemd (Docker containers, Codespaces, some WSL)
# 
# For environments without systemd, you can also use Docker:
#   docker run --name glow-dev-db -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:16
# Or set PGHOST/DATABASE_URL to point to an external database.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- LOAD .env -------------------------------------------------------
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${script_dir}/.env" ]]; then
  set -a
  source "${script_dir}/.env"
  set +a
fi

# --- CONFIG ----------------------------------------------------------
CLEAN_DB=false
RUN_TESTS=false
DETACHED=false
START_TURN=true

# Process command-line arguments
for arg in "$@"; do
  case $arg in 
    --clean) CLEAN_DB=true; shift ;;
    --test) RUN_TESTS=true; shift ;;
    --detach) DETACHED=true; shift ;;
    --no-turn) START_TURN=false; shift ;;
    --help|-h) 
      echo "🚀 Glow Development Environment"
      echo ""
      echo "Usage: bash run.sh [options]"
      echo ""
      echo "Options:"
      echo "  --clean    Start with fresh database from init.sql (creates backup first)"
      echo "  --test     Run all test suites after startup"
      echo "  --detach   Run in detached mode (services run in background, script exits)"
      echo "  --no-turn  Skip TURN/STUN server startup (use external or Docker)"
      echo "  --help     Show this help message"
      echo ""
      echo "This script will:"
      echo "  1. Start the TURN/STUN server (coturn) for WebRTC"
      echo "  2. Start the database (from latest backup or fresh if --clean)"
      echo "  3. Start client and server in parallel"
      echo "  4. Optionally run test suites"
      echo ""
      echo "Database behavior:"
      echo "  Default: Restore from latest backup (like 'yarn start')"
      echo "  --clean: Create backup, then start fresh (like 'yarn start --clean')"
      echo ""
      echo "TURN/STUN server:"
      echo "  Default: Start local coturn server for WebRTC connectivity"
      echo "  --no-turn: Skip TURN server (use external or Docker setup)"
      echo ""
      echo "Environment compatibility:"
      echo "  This script works on macOS, Linux with systemd, and containers/Codespaces"
      echo "  For Docker environments, you can also run PostgreSQL in a container:"
      echo "    docker run --name glow-dev-db -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:16"
      echo "  Or set PGHOST/DATABASE_URL environment variables for external databases"
      exit 0
      ;;
  esac
done

# --- HELPER FUNCTIONS ------------------------------------------------
log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
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

log_info() {
  echo -e "${CYAN}[INFO]${NC} $1"
}

# Check if a process is running on a port
check_port() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Check if a UDP port is in use
check_udp_port() {
  local port=$1
  if lsof -Pi :$port -sUDP:Listen -t >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Wait for a service to be ready
wait_for_service() {
  local service_name=$1
  local port=$2
  local max_attempts=${3:-30}
  local attempt=0
  
  log_info "Waiting for $service_name to be ready on port $port..."
  
  while [ $attempt -lt $max_attempts ]; do
    if check_port $port; then
      log_success "$service_name is ready!"
      return 0
    fi
    
    attempt=$((attempt + 1))
    sleep 2
    echo -n "."
  done
  
  log_error "$service_name failed to start within $((max_attempts * 2)) seconds"
  return 1
}

# Get public IP for TURN server configuration
get_public_ip() {
  # Try multiple methods to get public IP
  local public_ip=""
  
  # Method 1: Use curl to get external IP
  if command -v curl &>/dev/null; then
    public_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ipinfo.io/ip 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null)
  fi
  
  # Method 2: Use wget if curl failed
  if [[ -z "$public_ip" ]] && command -v wget &>/dev/null; then
    public_ip=$(wget -qO- --timeout=5 ifconfig.me 2>/dev/null || wget -qO- --timeout=5 ipinfo.io/ip 2>/dev/null)
  fi
  
  # Method 3: Use dig if available
  if [[ -z "$public_ip" ]] && command -v dig &>/dev/null; then
    public_ip=$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null | head -n1)
  fi
  
  # Fallback to localhost for local development
  if [[ -z "$public_ip" ]] || [[ ! "$public_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    public_ip="localhost"
  fi
  
  echo "$public_ip"
}

# Setup TURN server environment variables
setup_turn_env() {
  # Set default values if not already set
  export TURN_PUBLIC_IP="${TURN_PUBLIC_IP:-$(get_public_ip)}"
  export TURN_REALM="${TURN_REALM:-example.com}"
  export TURN_USERNAME="${TURN_USERNAME:-webrtc}"
  export TURN_PASS="${TURN_PASS:-$(openssl rand -base64 12 2>/dev/null || echo "changeMe")}"
  
  log_info "TURN server configuration:"
  log_info "  Public IP: $TURN_PUBLIC_IP"
  log_info "  Realm: $TURN_REALM"
  log_info "  Username: $TURN_USERNAME"
  log_info "  Password: $TURN_PASS"
}

# Start TURN/STUN server
start_turn_server() {
  if ! $START_TURN; then
    log_info "Skipping TURN server startup (--no-turn flag)"
    return 0
  fi
  
  log_step "Starting TURN/STUN server (coturn)..."
  
  # Setup environment variables
  setup_turn_env
  
  # Check if coturn is already running
  if check_udp_port 3478; then
    log_warning "Port 3478 is already in use. Checking if it's coturn..."
    if pgrep -f "turnserver\|coturn" >/dev/null; then
      log_success "TURN server is already running"
      return 0
    else
      log_error "Port 3478 is in use by another service. Please stop it or use --no-turn"
      return 1
    fi
  fi
  
  # Try Docker first (recommended)
  if command -v docker &>/dev/null && docker info &>/dev/null; then
    log_info "Starting TURN server using Docker..."
    
    # Stop existing container if running
    docker stop glow-turn 2>/dev/null || true
    docker rm glow-turn 2>/dev/null || true
    
    # Start coturn container
    docker run -d \
      --name glow-turn \
      --restart unless-stopped \
      -p 3478:3478/udp \
      -p 3478:3478/tcp \
      -p 49160-49200:49160-49200/udp \
      coturn/coturn:4.6 \
      --log-file=stdout \
      --no-dtls \
      --no-tls \
      --lt-cred-mech \
      --realm="$TURN_REALM" \
      --user="$TURN_USERNAME:$TURN_PASS" \
      --external-ip="$TURN_PUBLIC_IP" \
      --listening-port=3478 \
      --min-port=49160 \
      --max-port=49200 \
      --verbose > /dev/null 2>&1 &
    
    # Wait a moment for container to start
    sleep 3
    
    if docker ps | grep -q glow-turn; then
      log_success "TURN server started using Docker (container: glow-turn)"
      return 0
    else
      log_warning "Docker TURN server failed to start, trying native installation..."
    fi
  fi
  
  # Try native coturn installation
  if ! command -v turnserver &>/dev/null; then
    log_warning "coturn not found. Attempting to install..."
    
    if command -v brew &>/dev/null; then
      log_info "Installing coturn via Homebrew..."
      brew install coturn
    elif command -v apt-get &>/dev/null; then
      log_info "Installing coturn via apt..."
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y coturn
    elif command -v yum &>/dev/null; then
      log_info "Installing coturn via yum..."
      sudo yum install -y coturn
    else
      log_error "Could not install coturn automatically."
      log_info "Please install coturn manually or use Docker:"
      log_info "  Docker: docker run -d --name glow-turn -p 3478:3478/udp coturn/coturn:4.6"
      return 1
    fi
  fi
  
  # Create temporary coturn config
  local turn_config=$(mktemp)
  cat > "$turn_config" << EOF
listening-port=3478
external-ip=$TURN_PUBLIC_IP
realm=$TURN_REALM
user=$TURN_USERNAME:$TURN_PASS
lt-cred-mech
log-file=stdout
no-dtls
no-tls
min-port=49160
max-port=49200
verbose
EOF
  
  # Start coturn
  log_info "Starting native coturn server..."
  turnserver -c "$turn_config" &
  TURN_PID=$!
  
  # Clean up config file
  rm -f "$turn_config"
  
  # Wait a moment and check if it started
  sleep 3
  if kill -0 $TURN_PID 2>/dev/null; then
    log_success "TURN server started (PID: $TURN_PID)"
    return 0
  else
    log_error "Failed to start TURN server"
    return 1
  fi
}

# --- DEPENDENCY CHECKS -----------------------------------------------
check_and_install_deps() {
  log_step "Checking and installing dependencies..."
  
  # Skip PostgreSQL setup if external database is configured
  if [[ -n "${PGHOST:-}" ]] || [[ -n "${DATABASE_URL:-}" ]]; then
    log_info "External database configured (PGHOST or DATABASE_URL set), skipping PostgreSQL installation"
  elif ! command -v psql &>/dev/null; then
    log_warning "PostgreSQL not found. Attempting to install..."
    if command -v brew &>/dev/null; then
      log_info "Installing PostgreSQL via Homebrew..."
      brew install postgresql@15
      brew services start postgresql@15
    elif command -v apt-get &>/dev/null; then
      log_info "Installing PostgreSQL via apt..."
      sudo apt-get update
      sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib
      # Don't try to start with systemctl here - let the startup logic handle it
      log_info "PostgreSQL packages installed, startup will be handled later"
    elif command -v yum &>/dev/null; then
      log_info "Installing PostgreSQL via yum..."
      sudo yum install -y postgresql-server postgresql-contrib
      sudo postgresql-setup initdb
      # Don't try to start with systemctl here - let the startup logic handle it
      log_info "PostgreSQL packages installed, startup will be handled later"
    else
      log_error "Could not install PostgreSQL automatically. Please install manually."
      log_info "See README.md for installation instructions."
      exit 1
    fi
    log_success "PostgreSQL installed successfully"
  else
    log_success "PostgreSQL found"
  fi
  
    # Check if PostgreSQL is running (skip if external database configured)
  if [[ -n "${PGHOST:-}" ]] || [[ -n "${DATABASE_URL:-}" ]]; then
    log_info "Using external database, skipping local PostgreSQL startup check"
  elif ! pg_isready -q 2>/dev/null; then
    log_warning "PostgreSQL is not running. Attempting to start..."
    if command -v brew &>/dev/null; then
      brew services start postgresql@15
    elif command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null; then
      # Only use systemctl if systemd is actually running
      sudo systemctl start postgresql
    elif command -v pg_ctlcluster &>/dev/null; then
      # Debian/Ubuntu systems - try to start with pg_ctlcluster
      log_info "Using pg_ctlcluster to start PostgreSQL..."
      # Try different versions (16, 15, 14, 13)
      for version in 16 15 14 13; do
        if sudo pg_ctlcluster $version main start 2>/dev/null; then
          log_success "PostgreSQL $version started with pg_ctlcluster"
          break
        fi
      done
    elif command -v pg_ctl &>/dev/null; then
      # Generic PostgreSQL start
      log_info "Using pg_ctl to start PostgreSQL..."
      # Try common data directories
      for data_dir in "/var/lib/postgresql/data" "/var/lib/postgresql/16/main" "/var/lib/postgresql/15/main" "/usr/local/var/postgres"; do
        if [ -d "$data_dir" ]; then
          if sudo -u postgres pg_ctl -D "$data_dir" -l "$data_dir/logfile" start 2>/dev/null; then
            log_success "PostgreSQL started with pg_ctl using $data_dir"
            break
          fi
        fi
      done
    else
      log_warning "Could not find a way to start PostgreSQL automatically."
      log_info "Please start PostgreSQL manually or use Docker:"
      log_info "  docker run --name glow-dev-db -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:16"
      log_info "Or set PGHOST/DATABASE_URL environment variables to point to an external database."
      exit 1
    fi
    
    # Wait a moment and check again
    sleep 3
    if pg_isready -q 2>/dev/null; then
      log_success "PostgreSQL started successfully"
    else
      log_error "PostgreSQL failed to start. Please check your installation."
      log_info "You may need to:"
      log_info "  1. Initialize the database cluster first"
      log_info "  2. Use Docker: docker run --name glow-dev-db -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:16"
      log_info "  3. Set PGHOST/DATABASE_URL to point to an external database"
      exit 1
    fi
  else
    log_success "PostgreSQL is running"
  fi
  
  # Install client dependencies
  log_info "Installing client dependencies..."
  cd client
  if ! yarn install --frozen-lockfile 2>/dev/null; then
    log_warning "Frozen lockfile failed, trying regular install..."
    yarn install
  fi
  log_success "Client dependencies installed"
  cd ..
  
  # Install server dependencies
  log_info "Installing server dependencies..."
  cd server
  if ! make sync 2>/dev/null; then
    log_warning "Make sync failed, trying alternative..."
    if command -v uv &>/dev/null; then
      if ! uv venv 2>/dev/null; then
        log_warning "uv venv failed, continuing..."
      fi
      if ! uv pip install -r requirements.txt 2>/dev/null; then
        log_warning "uv pip install failed, trying regular pip..."
        if command -v pip &>/dev/null; then
          pip install -r requirements.txt
        else
          log_error "Could not install server dependencies. Please install uv or pip."
          exit 1
        fi
      fi
    elif command -v pip &>/dev/null; then
      pip install -r requirements.txt
    else
      log_error "Could not install server dependencies. Please install uv or pip."
      exit 1
    fi
  fi
  log_success "Server dependencies installed"
  cd ..
  
  # Install database dependencies
  log_info "Installing database dependencies..."
  cd database
  if ! yarn install --frozen-lockfile 2>/dev/null; then
    log_warning "Frozen lockfile failed, trying regular install..."
    yarn install
  fi
  log_success "Database dependencies installed"
  cd ..
  
  log_success "All dependencies checked and installed!"
}

# --- MAIN EXECUTION --------------------------------------------------
echo -e "${PURPLE}🌟 Starting Glow Development Environment${NC}"
echo ""

# Step 0: Check and install dependencies
check_and_install_deps

# Step 0.5: Start TURN/STUN server
if ! start_turn_server; then
  log_warning "TURN server failed to start, but continuing with other services"
  log_info "WebRTC may not work properly without a TURN server"
fi

# Step 1: Start Database
log_step "Step 1: Starting database..."
cd database

if $CLEAN_DB; then
  log_info "Clean flag detected - starting fresh database (will create backup first)"
  bash scripts/start.sh --clean &
else
  log_info "Starting database from latest backup"
  bash scripts/start.sh &
fi

DB_PID=$!
cd ..

# Wait a moment for database to initialize
sleep 3

# Check if database started successfully
if ! kill -0 $DB_PID 2>/dev/null; then
  log_error "Database failed to start"
  exit 1
fi

log_success "Database started (PID: $DB_PID)"

# Step 2: Start Client and Server in parallel
log_step "Step 2: Starting client and server in parallel..."

# Start Client
log_info "Starting client..."
cd client
yarn dev > ../client.log 2>&1 &
CLIENT_PID=$!
cd ..

# Start Server  
log_info "Starting server..."
cd server
make run > ../server.log 2>&1 &
SERVER_PID=$!
cd ..

log_info "Client PID: $CLIENT_PID"
log_info "Server PID: $SERVER_PID"

# Step 3: Wait for services to be ready
log_step "Step 3: Waiting for services to be ready..."

# Wait for client (Next.js typically runs on 3000)
if wait_for_service "Client" 3000 30; then
  log_success "Client is ready!"
else
  log_error "Client failed to start. Check client.log for details."
  tail -20 client.log
fi

# Wait for server (FastAPI typically runs on 8000)
if wait_for_service "Server" 8000 30; then
  log_success "Server is ready!"
else
  log_error "Server failed to start. Check server.log for details."
  tail -20 server.log
fi

# Step 4: Database is ready
log_step "Step 4: Database setup completed"
log_info "Database started using the same logic as 'yarn start' in database/"
if $CLEAN_DB; then
  log_info "Fresh database created from init.sql (backup was created first)"
else
  log_info "Database restored from latest backup"
fi

# Step 5: Final status
echo ""
log_step "Step 5: Environment Status:"
if $START_TURN && [[ -n "${TURN_PID:-}" ]]; then
  echo -e "  ${GREEN}✅ TURN Server:${NC} Running (PID: $TURN_PID) - UDP 3478"
elif $START_TURN && docker ps | grep -q glow-turn; then
  echo -e "  ${GREEN}✅ TURN Server:${NC} Running (Docker: glow-turn) - UDP 3478"
elif $START_TURN; then
  echo -e "  ${YELLOW}⚠️  TURN Server:${NC} Failed to start"
else
  echo -e "  ${CYAN}ℹ️  TURN Server:${NC} Skipped (--no-turn)"
fi
echo -e "  ${GREEN}✅ Database:${NC} Running (PID: $DB_PID)"
echo -e "  ${GREEN}✅ Client:${NC}   Running (PID: $CLIENT_PID) - http://localhost:3000"
echo -e "  ${GREEN}✅ Server:${NC}   Running (PID: $SERVER_PID) - http://localhost:8000"
echo ""

# Display TURN server configuration
if $START_TURN; then
  echo -e "${CYAN}🔗 WebRTC Configuration:${NC}"
  echo -e "  TURN_PUBLIC_IP: ${TURN_PUBLIC_IP}"
  echo -e "  TURN_REALM: ${TURN_REALM}"
  echo -e "  TURN_USERNAME: ${TURN_USERNAME}"
  echo -e "  TURN_PASS: ${TURN_PASS}"
  echo ""
fi

# Step 6: Run tests if requested
if $RUN_TESTS; then
  log_step "Step 6: Running test suites..."
  
  # Client tests
  log_info "Running client tests..."
  cd client
  if yarn test; then
    log_success "Client tests passed"
  else
    log_warning "Client tests had issues"
  fi
  cd ..
  
  # Server tests
  log_info "Running server tests..."
  cd server
  if make test; then
    log_success "Server tests passed"
  else
    log_warning "Server tests had issues"
  fi
  cd ..
  
  # Database E2E tests (Cypress)
  log_info "Running database E2E tests..."
  cd database
  if yarn test; then
    log_success "Database E2E tests passed"
  else
    log_warning "Database E2E tests had issues"
  fi
  cd ..
fi

# Step 7: Handle detached vs interactive mode
echo ""
log_success "🎉 All services are running!"
echo ""

if $DETACHED; then
  # Detached mode: show info and exit
  echo -e "${GREEN}✅ Services started in detached mode:${NC}"
  if $START_TURN && [[ -n "${TURN_PID:-}" ]]; then
    echo -e "  ${CYAN}TURN Server PID:${NC} $TURN_PID - UDP 3478"
  elif $START_TURN && docker ps | grep -q glow-turn; then
    echo -e "  ${CYAN}TURN Server:${NC} Docker container 'glow-turn' - UDP 3478"
  fi
  echo -e "  ${CYAN}Database PID:${NC} $DB_PID"
  echo -e "  ${CYAN}Client PID:${NC}   $CLIENT_PID - http://localhost:3000"
  echo -e "  ${CYAN}Server PID:${NC}   $SERVER_PID - http://localhost:8000"
  echo ""
  echo -e "${YELLOW}💡 To stop services later, run:${NC}"
  if $START_TURN && [[ -n "${TURN_PID:-}" ]]; then
    echo -e "  kill $TURN_PID $DB_PID $CLIENT_PID $SERVER_PID"
  elif $START_TURN && docker ps | grep -q glow-turn; then
    echo -e "  docker stop glow-turn && kill $DB_PID $CLIENT_PID $SERVER_PID"
  else
    echo -e "  kill $DB_PID $CLIENT_PID $SERVER_PID"
  fi
  echo ""
  echo -e "${YELLOW}💡 Or use process names:${NC}"
  echo -e "  pkill -f 'yarn dev'     # Stop client"
  echo -e "  pkill -f 'make run'     # Stop server"
  echo -e "  pkill -f 'start.sh'     # Stop database"
  if $START_TURN; then
    echo -e "  pkill -f 'turnserver'   # Stop TURN server"
    echo -e "  docker stop glow-turn   # Stop Docker TURN server"
  fi
  echo ""
  log_success "Services running in background. Script exiting."
  exit 0
else
  # Interactive mode: keep running and handle cleanup
  echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
  echo ""

  # Function to cleanup on exit
  cleanup() {
    echo ""
    log_info "Shutting down services..."
    
    # Kill TURN server
    if $START_TURN && [[ -n "${TURN_PID:-}" ]] && kill -0 $TURN_PID 2>/dev/null; then
      log_info "Stopping TURN server..."
      kill $TURN_PID
    elif $START_TURN && docker ps | grep -q glow-turn; then
      log_info "Stopping Docker TURN server..."
      docker stop glow-turn >/dev/null 2>&1
    fi
    
    # Kill all child processes
    if kill -0 $DB_PID 2>/dev/null; then
      log_info "Stopping database..."
      kill $DB_PID
    fi
    
    if kill -0 $CLIENT_PID 2>/dev/null; then
      log_info "Stopping client..."
      kill $CLIENT_PID
    fi
    
    if kill -0 $SERVER_PID 2>/dev/null; then
      log_info "Stopping server..."
      kill $SERVER_PID
    fi
    
    # Clean up log files
    rm -f client.log server.log
    
    log_success "All services stopped. Goodbye! 👋"
    exit 0
  }

  # Set up signal handlers
  trap cleanup SIGINT SIGTERM

  # Wait for any of the processes to exit
  wait
fi
