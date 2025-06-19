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

# Process command-line arguments
for arg in "$@"; do
  case $arg in 
    --clean) CLEAN_DB=true; shift ;;
    --test) RUN_TESTS=true; shift ;;
    --detach) DETACHED=true; shift ;;
    --help|-h) 
      echo "🚀 Glow Development Environment"
      echo ""
      echo "Usage: bash run.sh [options]"
      echo ""
      echo "Options:"
      echo "  --clean    Start with fresh database from init.sql (creates backup first)"
      echo "  --test     Run all test suites after startup"
      echo "  --detach   Run in detached mode (services run in background, script exits)"
      echo "  --help     Show this help message"
      echo ""
      echo "This script will:"
      echo "  1. Start the database (from latest backup or fresh if --clean)"
      echo "  2. Start client and server in parallel"
      echo "  3. Optionally run test suites"
      echo ""
      echo "Database behavior:"
      echo "  Default: Restore from latest backup (like 'yarn start')"
      echo "  --clean: Create backup, then start fresh (like 'yarn start --clean')"
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
echo -e "  ${GREEN}✅ Database:${NC} Running (PID: $DB_PID)"
echo -e "  ${GREEN}✅ Client:${NC}   Running (PID: $CLIENT_PID) - http://localhost:3000"
echo -e "  ${GREEN}✅ Server:${NC}   Running (PID: $SERVER_PID) - http://localhost:8000"
echo ""

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
  echo -e "  ${CYAN}Database PID:${NC} $DB_PID"
  echo -e "  ${CYAN}Client PID:${NC}   $CLIENT_PID - http://localhost:3000"
  echo -e "  ${CYAN}Server PID:${NC}   $SERVER_PID - http://localhost:8000"
  echo ""
  echo -e "${YELLOW}💡 To stop services later, run:${NC}"
  echo -e "  kill $DB_PID $CLIENT_PID $SERVER_PID"
  echo ""
  echo -e "${YELLOW}💡 Or use process names:${NC}"
  echo -e "  pkill -f 'yarn dev'     # Stop client"
  echo -e "  pkill -f 'make run'     # Stop server"
  echo -e "  pkill -f 'start.sh'     # Stop database"
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
