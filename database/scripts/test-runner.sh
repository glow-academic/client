#!/bin/bash

# Glow E2E Test Runner
# Usage: ./test-runner.sh [test-name] [options]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
show_usage() {
    echo -e "${BLUE}Glow E2E Test Runner${NC}"
    echo ""
    echo "Usage: $0 [test-name] [options]"
    echo ""
    echo "Available tests:"
    echo "  auth        - Authentication tests (login/logout)"
    echo "  agents      - Agent CRUD operations"
    echo "  scenarios   - Scenario CRUD + AI operations"
    echo "  chat        - Chat/simulation flow tests"
    echo "  classes     - Class management tests"
    echo "  documents   - Document upload/management tests"
    echo "  simulations - Simulation management tests"
    echo "  users       - User management tests"
    echo "  rubrics     - Rubric management tests"
    echo "  evals       - Evaluation system tests"
    echo "  logs        - Log viewing tests"
    echo "  all         - Run all tests"
    echo ""
    echo "Options:"
    echo "  --headed    - Run with browser visible"
    echo "  --open      - Open Cypress interactive mode"
    echo "  --help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 auth                    # Run auth tests headless"
    echo "  $0 agents --headed         # Run agents tests with browser"
    echo "  $0 scenarios --open        # Open scenarios tests in interactive mode"
    echo "  $0 all                     # Run all tests"
}

# Function to run a specific test
run_test() {
    local test_name=$1
    local options=$2
    
    case $test_name in
        "auth")
            spec="cypress/e2e/auth.cy.ts"
            ;;
        "agents")
            spec="cypress/e2e/agents.cy.ts"
            ;;
        "scenarios")
            spec="cypress/e2e/scenarios.cy.ts"
            ;;
        "chat")
            spec="cypress/e2e/chat.cy.ts"
            ;;
        "classes")
            spec="cypress/e2e/classes.cy.ts"
            ;;
        "documents")
            spec="cypress/e2e/documents.cy.ts"
            ;;
        "simulations")
            spec="cypress/e2e/simulations.cy.ts"
            ;;
        "users")
            spec="cypress/e2e/users.cy.ts"
            ;;
        "rubrics")
            spec="cypress/e2e/rubrics.cy.ts"
            ;;
        "evals")
            spec="cypress/e2e/evals.cy.ts"
            ;;
        "logs")
            spec="cypress/e2e/logs.cy.ts"
            ;;
        "all")
            spec="cypress/e2e/**/*.cy.ts"
            ;;
        *)
            echo -e "${RED}Error: Unknown test '$test_name'${NC}"
            show_usage
            exit 1
            ;;
    esac
    
    echo -e "${YELLOW}Running $test_name tests...${NC}"
    echo -e "${BLUE}Spec: $spec${NC}"
    echo ""
    
    if [[ $options == *"--open"* ]]; then
        echo -e "${GREEN}Opening Cypress interactive mode...${NC}"
        echo -e "${BLUE}Note: You'll need to select the test file manually in the Cypress UI${NC}"
        yarn test:cypress:open
    elif [[ $options == *"--headed"* ]]; then
        echo -e "${GREEN}Running tests with browser visible...${NC}"
        yarn cypress run --spec "$spec" --headed
    else
        echo -e "${GREEN}Running tests in headless mode...${NC}"
        yarn test:cypress --spec "$spec"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if we're in the right directory
    if [[ ! -f "cypress.config.ts" ]]; then
        echo -e "${RED}Error: cypress.config.ts not found. Please run this script from the database directory.${NC}"
        exit 1
    fi
    
    # Check if yarn is available
    if ! command -v yarn &> /dev/null; then
        echo -e "${RED}Error: yarn is not installed or not in PATH${NC}"
        exit 1
    fi
    
    # Check if node_modules exists
    if [[ ! -d "node_modules" ]]; then
        echo -e "${YELLOW}Installing dependencies...${NC}"
        yarn install
    fi
    
    echo -e "${GREEN}Prerequisites check passed!${NC}"
    echo ""
}

# Function to show test status
show_test_status() {
    echo -e "${BLUE}Test Implementation Status:${NC}"
    echo ""
    echo -e "${GREEN}✅ Fully Implemented:${NC}"
    echo "  - auth (Authentication flows)"
    echo "  - agents (CRUD + query testing)"
    echo "  - scenarios (CRUD + AI operations)"
    echo "  - chat (Full simulation flow)"
    echo ""
    echo -e "${YELLOW}🚧 Template Only (Need Implementation):${NC}"
    echo "  - classes (Class management)"
    echo "  - documents (File upload/TUS)"
    echo "  - simulations (Simulation management)"
    echo "  - users (User management)"
    echo "  - rubrics (Rubric management)"
    echo "  - evals (Evaluation system)"
    echo "  - logs (Log viewing)"
    echo ""
}

# Main script logic
main() {
    # Handle help flag
    if [[ $1 == "--help" ]] || [[ $1 == "-h" ]]; then
        show_usage
        exit 0
    fi
    
    # Handle status flag
    if [[ $1 == "--status" ]] || [[ $1 == "-s" ]]; then
        show_test_status
        exit 0
    fi
    
    # Check if no arguments provided
    if [[ $# -eq 0 ]]; then
        echo -e "${RED}Error: No test specified${NC}"
        echo ""
        show_usage
        exit 1
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Get test name and options
    test_name=$1
    shift
    options="$*"
    
    # Run the test
    run_test "$test_name" "$options"
}

# Run main function with all arguments
main "$@" 