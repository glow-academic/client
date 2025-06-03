#!/bin/bash

# GLOW Modular Test Runner
# This script starts the necessary services and runs Cypress tests

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
    echo "GLOW Modular Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --headless              Run tests in headless mode"
    echo "  --spec FILE             Run specific test file (e.g., auth.cy.ts)"
    echo "  --category CATEGORY     Run specific test category:"
    echo "                            auth     - Authentication tests"
    echo "                            quiz     - Quiz functionality tests"
    echo "                            chat     - Chat functionality tests"
    echo "                            ui       - UI and navigation tests"
    echo "                            login    - Basic login tests"
    echo "                            all      - All tests (default)"
    echo "  --parallel              Run tests in parallel (headless only)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests interactively"
    echo "  $0 --headless                        # Run all tests in headless mode"
    echo "  $0 --category auth                   # Run only authentication tests"
    echo "  $0 --spec auth.cy.ts --headless      # Run specific file in headless mode"
    echo "  $0 --category quiz --parallel        # Run quiz tests in parallel"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
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

# Function to cleanup background processes
cleanup() {
    print_status "Cleaning up background processes..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$DB_PID" ]; then
        kill $DB_PID 2>/dev/null || true
    fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Parse command line arguments
HEADLESS=false
SPEC=""
CATEGORY="all"
PARALLEL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --headless)
            HEADLESS=true
            shift
            ;;
        --spec)
            SPEC="$2"
            shift 2
            ;;
        --category)
            CATEGORY="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL=true
            HEADLESS=true  # Parallel requires headless
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

print_status "Starting GLOW Modular Test Suite..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the client directory"
    exit 1
fi

# Check if database is running
if ! check_port 5432; then
    print_warning "Database not running on port 5432"
    print_status "Starting database..."
    cd ../database
    bash run.sh --clean &
    DB_PID=$!
    cd ../client
    sleep 10
fi

# Check if backend is running
if ! check_port 8000; then
    print_warning "Backend not running on port 8000"
    print_status "Starting backend server..."
    cd ../server
    make run &
    BACKEND_PID=$!
    cd ../client
    
    # Wait for backend to be ready
    wait_for_service "http://localhost:8000" "Backend API"
fi

# Check if frontend is running
if ! check_port 3000; then
    print_warning "Frontend not running on port 3000"
    print_status "Starting frontend development server..."
    npm run dev &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    wait_for_service "http://localhost:3000" "Frontend"
else
    print_success "Frontend already running on port 3000"
fi

# Give services a moment to fully initialize
sleep 5

# Determine which tests to run
TEST_SPEC=""
if [ ! -z "$SPEC" ]; then
    TEST_SPEC="cypress/e2e/$SPEC"
    print_status "Running specific test file: $SPEC"
elif [ "$CATEGORY" != "all" ]; then
    case $CATEGORY in
        auth)
            TEST_SPEC="cypress/e2e/auth.cy.ts"
            print_status "Running authentication tests"
            ;;
        quiz)
            TEST_SPEC="cypress/e2e/quiz.cy.ts"
            print_status "Running quiz functionality tests"
            ;;
        chat)
            TEST_SPEC="cypress/e2e/chat.cy.ts"
            print_status "Running chat functionality tests"
            ;;
        ui)
            TEST_SPEC="cypress/e2e/ui-navigation.cy.ts"
            print_status "Running UI and navigation tests"
            ;;
        login)
            TEST_SPEC="cypress/e2e/login.cy.ts"
            print_status "Running basic login tests"
            ;;
    esac
else
    print_status "Running all tests"
fi

# Run Cypress tests
print_status "Executing Cypress tests..."

if [ "$HEADLESS" = true ]; then
    if [ "$PARALLEL" = true ] && [ "$CATEGORY" = "all" ] && [ -z "$SPEC" ]; then
        print_status "Running all tests in parallel mode"
        npx cypress run --headless --record false --parallel || {
            print_warning "Parallel mode failed, falling back to sequential execution"
            npx cypress run --headless
        }
    elif [ ! -z "$TEST_SPEC" ]; then
        npx cypress run --spec "$TEST_SPEC" --headless
    else
        npx cypress run --headless
    fi
else
    if [ ! -z "$TEST_SPEC" ]; then
        print_status "Opening Cypress Test Runner for: $TEST_SPEC"
        npx cypress open --e2e --spec "$TEST_SPEC"
    else
        print_status "Opening Cypress Test Runner"
        npx cypress open --e2e
    fi
fi

print_success "Test execution completed!"

# Show summary
echo ""
print_status "Test Summary:"
if [ ! -z "$SPEC" ]; then
    echo "  - Ran specific file: $SPEC"
elif [ "$CATEGORY" != "all" ]; then
    echo "  - Ran category: $CATEGORY"
else
    echo "  - Ran all test files:"
    echo "    • login.cy.ts (Basic authentication)"
    echo "    • auth.cy.ts (Comprehensive authentication)"
    echo "    • quiz.cy.ts (Quiz functionality)"
    echo "    • chat.cy.ts (Chat functionality)"
    echo "    • ui-navigation.cy.ts (UI and navigation)"
fi

if [ "$HEADLESS" = true ]; then
    echo "  - Mode: Headless"
    if [ "$PARALLEL" = true ]; then
        echo "  - Execution: Parallel"
    fi
else
    echo "  - Mode: Interactive"
fi 