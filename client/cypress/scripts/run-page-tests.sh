#!/bin/bash

# GLOW Page-Based Test Runner
# Run streamlined page tests for the GLOW application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MODE="interactive"
SPEC=""
BROWSER="chrome"

# Function to display usage
usage() {
    echo -e "${BLUE}GLOW Page-Based Test Runner${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -m, --mode MODE     Test mode: 'interactive' or 'headless' (default: interactive)"
    echo "  -s, --spec SPEC     Run specific test file (e.g., 'login', 'chat', 'dashboard-chats')"
    echo "  -b, --browser BROWSER Browser to use: 'chrome', 'firefox', 'edge' (default: chrome)"
    echo "  -a, --all           Run all page tests"
    echo "  -c, --comprehensive Run comprehensive test suite"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run in interactive mode"
    echo "  $0 -m headless                       # Run all tests headlessly"
    echo "  $0 -s login                          # Run only login tests"
    echo "  $0 -s chat -m headless               # Run chat tests headlessly"
    echo "  $0 -a -m headless                    # Run all page tests headlessly"
    echo "  $0 -c                                # Run comprehensive test suite"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -s|--spec)
            SPEC="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -a|--all)
            SPEC="all-pages"
            shift
            ;;
        -c|--comprehensive)
            SPEC="test-suite"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Validate mode
if [[ "$MODE" != "interactive" && "$MODE" != "headless" ]]; then
    echo -e "${RED}Error: Mode must be 'interactive' or 'headless'${NC}"
    exit 1
fi

# Check if we're in the client directory
if [[ ! -f "cypress.config.ts" ]]; then
    echo -e "${RED}Error: Please run this script from the client directory${NC}"
    exit 1
fi

echo -e "${BLUE}🧪 GLOW Page-Based Test Runner${NC}"
echo -e "${YELLOW}Mode: $MODE${NC}"
echo -e "${YELLOW}Browser: $BROWSER${NC}"

# Build the cypress command
if [[ "$MODE" == "headless" ]]; then
    CYPRESS_CMD="npx cypress run --browser $BROWSER"
else
    CYPRESS_CMD="npx cypress open --browser $BROWSER"
fi

# Handle different spec options
case "$SPEC" in
    "")
        echo -e "${GREEN}Running all tests in $MODE mode...${NC}"
        $CYPRESS_CMD
        ;;
    "all-pages")
        echo -e "${GREEN}Running all page tests...${NC}"
        $CYPRESS_CMD --spec "cypress/e2e/pages/*.cy.ts"
        ;;
    "test-suite")
        echo -e "${GREEN}Running comprehensive test suite...${NC}"
        $CYPRESS_CMD --spec "cypress/e2e/pages/test-suite.cy.ts"
        ;;
    *)
        # Check if the spec file exists
        SPEC_FILE="cypress/e2e/pages/${SPEC}.cy.ts"
        if [[ -f "$SPEC_FILE" ]]; then
            echo -e "${GREEN}Running $SPEC tests...${NC}"
            $CYPRESS_CMD --spec "$SPEC_FILE"
        else
            echo -e "${RED}Error: Test file $SPEC_FILE not found${NC}"
            echo -e "${YELLOW}Available page tests:${NC}"
            ls cypress/e2e/pages/*.cy.ts 2>/dev/null | sed 's/.*\//  - /' | sed 's/\.cy\.ts//'
            exit 1
        fi
        ;;
esac

echo -e "${GREEN}✅ Test execution completed${NC}" 