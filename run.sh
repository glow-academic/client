#!/usr/bin/env bash
set -euo pipefail

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

# --- MAIN EXECUTION --------------------------------------------------
echo -e "${PURPLE}🌟 Starting Glow Development Environment${NC}"
echo ""

# Step 1: Start Database
log_step "Starting database..."
cd database

if $CLEAN_DB; then
  log_info "Clean flag detected - starting fresh database (will create backup first)"
  bash start.sh --clean &
else
  log_info "Starting database from latest backup"
  bash start.sh &
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
log_step "Starting client and server in parallel..."

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
log_step "Waiting for services to be ready..."

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
log_step "Database setup completed"
log_info "Database started using the same logic as 'yarn start' in database/"
if $CLEAN_DB; then
  log_info "Fresh database created from init.sql (backup was created first)"
else
  log_info "Database restored from latest backup"
fi

# Step 5: Final status
echo ""
log_step "Environment Status:"
echo -e "  ${GREEN}✅ Database:${NC} Running (PID: $DB_PID)"
echo -e "  ${GREEN}✅ Client:${NC}   Running (PID: $CLIENT_PID) - http://localhost:3000"
echo -e "  ${GREEN}✅ Server:${NC}   Running (PID: $SERVER_PID) - http://localhost:8000"
echo ""

# Step 6: Run tests if requested
if $RUN_TESTS; then
  log_step "Running test suites..."
  
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
