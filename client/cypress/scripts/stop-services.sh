#!/bin/bash

# GLOW Service Stopper
# This script stops all services running on the required ports

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

# Function to kill process on port
kill_port() {
    local port=$1
    local service_name=$2
    
    print_status "Checking for processes on port $port ($service_name)..."
    
    # Find processes using the port
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ -z "$pids" ]; then
        print_status "No processes found on port $port"
        return 0
    fi
    
    print_warning "Found processes on port $port: $pids"
    
    # Try graceful shutdown first
    for pid in $pids; do
        if kill -TERM $pid 2>/dev/null; then
            print_status "Sent SIGTERM to process $pid"
        fi
    done
    
    # Wait a moment for graceful shutdown
    sleep 3
    
    # Check if processes are still running
    local remaining_pids=$(lsof -ti :$port 2>/dev/null || true)
    
    if [ ! -z "$remaining_pids" ]; then
        print_warning "Processes still running, forcing shutdown..."
        for pid in $remaining_pids; do
            if kill -KILL $pid 2>/dev/null; then
                print_status "Force killed process $pid"
            fi
        done
        sleep 1
    fi
    
    # Final check
    local final_pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -z "$final_pids" ]; then
        print_success "Successfully stopped $service_name on port $port"
    else
        print_error "Failed to stop some processes on port $port"
        return 1
    fi
}

# Function to stop Node.js processes by name
stop_node_processes() {
    print_status "Stopping Node.js development processes..."
    
    # Stop Next.js dev server
    pkill -f "next dev" 2>/dev/null || true
    
    # Stop any remaining node processes related to our project
    pkill -f "glow.*node" 2>/dev/null || true
    
    # Stop Cypress processes
    pkill -f "cypress" 2>/dev/null || true
    
    print_success "Node.js processes stopped"
}

# Function to stop Python/FastAPI processes
stop_python_processes() {
    print_status "Stopping Python/FastAPI processes..."
    
    # Stop FastAPI/uvicorn processes
    pkill -f "uvicorn" 2>/dev/null || true
    pkill -f "fastapi" 2>/dev/null || true
    pkill -f "python.*server" 2>/dev/null || true
    
    print_success "Python processes stopped"
}

print_status "Stopping GLOW services..."

# Stop processes by port
kill_port 3000 "Frontend (Next.js)"
kill_port 8000 "Backend (FastAPI)"

# Stop processes by name (additional cleanup)
stop_node_processes
stop_python_processes

# Additional cleanup for any remaining processes
print_status "Performing additional cleanup..."

# Kill any remaining processes that might be holding the ports
for port in 3000 8000; do
    remaining=$(lsof -ti :$port 2>/dev/null || true)
    if [ ! -z "$remaining" ]; then
        print_warning "Force killing remaining processes on port $port"
        kill -KILL $remaining 2>/dev/null || true
    fi
done

# Clean up any orphaned processes
pkill -f "webpack" 2>/dev/null || true
pkill -f "esbuild" 2>/dev/null || true

print_success "All services stopped successfully!"

# Show final port status
print_status "Final port status:"
for port in 3000 5432 8000; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "  Port $port: OCCUPIED"
    else
        echo "  Port $port: FREE"
    fi
done

echo ""
print_status "You can now restart services with: npm run services:restart"
print_status "Or run clean tests with: npm run test:clean" 