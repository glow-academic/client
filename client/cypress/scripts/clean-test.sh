#!/bin/bash

# GLOW Clean Test Runner
# This script stops all services, restarts them cleanly, and runs tests

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

# Function to show help
show_help() {
    echo "GLOW Clean Test Runner"
    echo ""
    echo "This script performs a complete clean restart and runs tests:"
    echo "1. Stops all running services"
    echo "2. Restarts services cleanly"
    echo "3. Runs Cypress tests"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --category CATEGORY     Run specific test category:"
    echo "                            auth     - Authentication tests"
    echo "                            quiz     - Quiz functionality tests"
    echo "                            chat     - Chat functionality tests"
    echo "                            ui       - UI and navigation tests"
    echo "                            login    - Basic login tests"
    echo "                            all      - All tests (default)"
    echo "  --spec FILE             Run specific test file (e.g., auth.cy.ts)"
    echo "  --interactive           Run tests in interactive mode"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Clean restart + run all tests"
    echo "  $0 --category auth                   # Clean restart + auth tests only"
    echo "  $0 --spec auth.cy.ts                 # Clean restart + specific file"
    echo "  $0 --interactive                     # Clean restart + interactive mode"
}

# Function to cleanup on exit
cleanup() {
    if [ ! -z "$CLEANUP_NEEDED" ]; then
        print_status "Cleaning up background processes..."
        # The restart script handles cleanup, but just in case
        pkill -f "cypress" 2>/dev/null || true
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Parse command line arguments
CATEGORY="all"
SPEC=""
INTERACTIVE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --category)
            CATEGORY="$2"
            shift 2
            ;;
        --spec)
            SPEC="$2"
            shift 2
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate category
case $CATEGORY in
    auth|quiz|chat|ui|login|all)
        ;;
    *)
        print_error "Invalid category: $CATEGORY"
        print_error "Valid categories: auth, quiz, chat, ui, login, all"
        exit 1
        ;;
esac

print_status "Starting GLOW Clean Test Process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the client directory"
    exit 1
fi

# Step 1: Clean restart of all services
print_status "Step 1: Performing clean service restart..."
./cypress/scripts/restart-services.sh

if [ $? -ne 0 ]; then
    print_error "Failed to restart services. Aborting test run."
    exit 1
fi

# Step 2: Wait a moment for services to stabilize
print_status "Step 2: Allowing services to stabilize..."
sleep 5

# Step 3: Verify services are ready
print_status "Step 3: Final service verification..."

services_ready=true

# Quick health checks
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
    print_error "Frontend not responding"
    services_ready=false
fi

if ! curl -s http://localhost:8000 >/dev/null 2>&1; then
    print_error "Backend not responding"
    services_ready=false
fi

if ! lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null 2>&1; then
    print_error "Database not responding"
    services_ready=false
fi

if [ "$services_ready" = false ]; then
    print_error "Services are not ready. Aborting test run."
    exit 1
fi

print_success "All services are ready!"

# Step 4: Run Cypress tests
print_status "Step 4: Running Cypress tests..."

CLEANUP_NEEDED=true

# Build test command
if [ "$INTERACTIVE" = true ]; then
    print_status "Running tests in interactive mode..."
    if [ ! -z "$SPEC" ]; then
        ./cypress/scripts/run-tests.sh --spec "$SPEC"
    elif [ "$CATEGORY" != "all" ]; then
        ./cypress/scripts/run-tests.sh --category "$CATEGORY"
    else
        ./cypress/scripts/run-tests.sh
    fi
else
    print_status "Running tests in headless mode..."
    if [ ! -z "$SPEC" ]; then
        ./cypress/scripts/run-tests.sh --spec "$SPEC" --headless
    elif [ "$CATEGORY" != "all" ]; then
        ./cypress/scripts/run-tests.sh --category "$CATEGORY" --headless
    else
        ./cypress/scripts/run-tests.sh --headless
    fi
fi

test_exit_code=$?

CLEANUP_NEEDED=""

# Step 5: Report results
echo ""
print_status "Test Results Summary:"
if [ $test_exit_code -eq 0 ]; then
    print_success "✓ All tests passed!"
else
    print_error "✗ Some tests failed (exit code: $test_exit_code)"
fi

echo ""
print_status "Services are still running:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  Database: localhost:5432"

echo ""
print_status "To stop services: npm run services:stop"
print_status "To restart services: npm run services:restart"

exit $test_exit_code 