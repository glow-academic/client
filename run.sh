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

# Process command-line arguments
for arg in "$@"; do
  case $arg in 
    --clean) CLEAN_DB=true; shift ;;
    --test) RUN_TESTS=true; shift ;;
    --help|-h) 
      echo "🚀 Glow Development Environment"
      echo ""
      echo "Usage: bash run.sh [options]"
      echo ""
      echo "Options:"
      echo "  --clean    Clean database before starting"
      echo "  --test     Run all test suites after startup"
      echo "  --help     Show this help message"
      echo ""
      echo "This script will:"
      echo "  1. Start the database"
      echo "  2. Start client and server in parallel"
      echo "  3. Handle database migrations automatically"
      echo "  4. Optionally run test suites"
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
  log_info "Clean flag detected - will clean database"
  bash start.sh --clean &
else
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

# Step 4: Handle migrations
log_step "Handling database migrations..."
cd client

# Generate migrations if schema has changed
log_info "Generating migrations from current schema..."
if npx drizzle-kit generate > ../migration.log 2>&1; then
  log_success "Migrations generated successfully"
  
  # Check if any new migration files were created
  if ls ../database/migrations/*.sql >/dev/null 2>&1; then
    log_info "Applying new migrations to database..."
    cd ../database
    
    # Apply migrations
    if yarn migrate > ../migrate.log 2>&1; then
      log_success "Migrations applied successfully"
    else
      log_warning "Migration application had issues - continuing with current database state"
      log_info "Check migrate.log for details"
    fi
    cd ../client
  else
    log_info "No new migrations to apply"
  fi
else
  log_warning "Migration generation had issues - continuing with current state"
  log_info "Check migration.log for details"
fi

cd ..

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

# Step 7: Keep running and handle cleanup
echo ""
log_success "🎉 All services are running!"
echo ""
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
  rm -f client.log server.log migration.log migrate.log
  
  log_success "All services stopped. Goodbye! 👋"
  exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for any of the processes to exit
wait
