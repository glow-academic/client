#!/bin/bash

# GLOW Service Restarter
# This script stops all services and restarts them cleanly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the client directory"
        exit 1
    fi
}

print_status "Restarting GLOW services..."

# Check directory
check_directory

# Step 1: Stop all services
print_status "Step 1: Stopping all existing services..."
./cypress/scripts/stop-services.sh

# Wait a moment for cleanup
sleep 2

# Step 2: Start database (if not running)
print_status "Step 2: Checking database..."
if ! lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_warning "Database not running on port 5432"
    print_status "Starting database..."
    cd ../database
    bash run.sh --clean &
    DB_PID=$!
    cd ../client
    print_status "Database starting in background (PID: $DB_PID)"
    sleep 10
else
    print_success "Database already running on port 5432"
fi

# Step 3: Start backend
print_status "Step 3: Starting backend server..."
cd ../server
make run &
BACKEND_PID=$!
cd ../client
print_status "Backend starting in background (PID: $BACKEND_PID)"

# Wait for backend to be ready
wait_for_service "http://localhost:8000" "Backend API"

# Step 4: Start frontend
print_status "Step 4: Starting frontend development server..."
npm run dev &
FRONTEND_PID=$!
print_status "Frontend starting in background (PID: $FRONTEND_PID)"

# Wait for frontend to be ready
wait_for_service "http://localhost:3000" "Frontend"

# Step 5: Verify all services
print_status "Step 5: Verifying all services..."

services_ready=true

# Check database
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_success "✓ Database running on port 5432"
else
    print_error "✗ Database not responding on port 5432"
    services_ready=false
fi

# Check backend
if curl -s http://localhost:8000 >/dev/null 2>&1; then
    print_success "✓ Backend API running on port 8000"
else
    print_error "✗ Backend API not responding on port 8000"
    services_ready=false
fi

# Check frontend
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    print_success "✓ Frontend running on port 3000"
else
    print_error "✗ Frontend not responding on port 3000"
    services_ready=false
fi

if [ "$services_ready" = true ]; then
    print_success "All services are running successfully!"
    echo ""
    print_status "Service URLs:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:8000"
    echo "  Database: localhost:5432"
    echo ""
    print_status "You can now run tests with:"
    echo "  npm run test:e2e          # Interactive mode"
    echo "  npm run test:e2e:headless # Headless mode"
    echo "  npm run test:clean        # Clean restart + tests"
else
    print_error "Some services failed to start properly!"
    print_status "Check the logs above for details"
    exit 1
fi 