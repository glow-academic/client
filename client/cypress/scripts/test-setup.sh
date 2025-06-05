#!/bin/bash

# GLOW Test Setup Script
# Helps set up and run tests with proper service dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 GLOW Test Setup${NC}"

# Function to check if a service is running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $name is not running${NC}"
        return 1
    fi
}

# Function to check if PostgreSQL is running
check_postgres() {
    if command -v pg_isready > /dev/null 2>&1; then
        # Use pg_isready if available
        if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Database (PostgreSQL) is running${NC}"
            return 0
        else
            echo -e "${RED}❌ Database (PostgreSQL) is not running${NC}"
            return 1
        fi
    else
        # Fallback: try to connect using netcat or telnet
        if command -v nc > /dev/null 2>&1; then
            if nc -z localhost 5432 > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Database (PostgreSQL) is running${NC}"
                return 0
            else
                echo -e "${RED}❌ Database (PostgreSQL) is not running${NC}"
                return 1
            fi
        elif command -v telnet > /dev/null 2>&1; then
            if timeout 1 telnet localhost 5432 > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Database (PostgreSQL) is running${NC}"
                return 0
            else
                echo -e "${RED}❌ Database (PostgreSQL) is not running${NC}"
                return 1
            fi
        else
            echo -e "${YELLOW}⚠️  Cannot check database status (no pg_isready, nc, or telnet available)${NC}"
            echo -e "${YELLOW}  Assuming database is running. If tests fail, check manually.${NC}"
            return 0
        fi
    fi
}

# Function to display usage
usage() {
    echo -e "${BLUE}GLOW Test Setup${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -c, --check         Check if all services are running"
    echo "  -s, --start         Start all services and run tests"
    echo "  -t, --test-only     Run tests only (assumes services are running)"
    echo "  -o, --open          Open Cypress in interactive mode"
    echo ""
    echo "Examples:"
    echo "  $0 -c                # Check service status"
    echo "  $0 -s                # Start services and run tests"
    echo "  $0 -t                # Run tests only"
    echo "  $0 -o                # Open Cypress GUI"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -c|--check)
            echo -e "${YELLOW}Checking service status...${NC}"
            
            # Check database
            if check_postgres; then
                DB_STATUS="✅"
            else
                DB_STATUS="❌"
                echo -e "${YELLOW}  To start: cd ../database && bash run.sh --clean${NC}"
            fi
            
            # Check backend
            if check_service "http://localhost:8000/docs" "Backend (FastAPI)"; then
                BACKEND_STATUS="✅"
            else
                BACKEND_STATUS="❌"
                echo -e "${YELLOW}  To start: cd ../server && make run${NC}"
            fi
            
            # Check frontend
            if check_service "http://localhost:3000" "Frontend (Next.js)"; then
                FRONTEND_STATUS="✅"
            else
                FRONTEND_STATUS="❌"
                echo -e "${YELLOW}  To start: yarn run dev${NC}"
            fi
            
            echo ""
            echo -e "${BLUE}Service Status Summary:${NC}"
            echo -e "  Database:  $DB_STATUS"
            echo -e "  Backend:   $BACKEND_STATUS"
            echo -e "  Frontend:  $FRONTEND_STATUS"
            
            if [[ "$DB_STATUS" == "✅" && "$BACKEND_STATUS" == "✅" && "$FRONTEND_STATUS" == "✅" ]]; then
                echo -e "${GREEN}🎉 All services are running! You can run tests now.${NC}"
                exit 0
            else
                echo -e "${RED}⚠️  Some services are not running. Start them before running tests.${NC}"
                exit 1
            fi
            ;;
        -s|--start)
            echo -e "${YELLOW}Starting services and running tests...${NC}"
            echo -e "${BLUE}Note: This will start the frontend only. Make sure database and backend are running.${NC}"
            
            # Check if database and backend are running
            if ! check_service "http://localhost:8000/docs" "Backend"; then
                echo -e "${RED}❌ Backend is not running. Please start it first:${NC}"
                echo -e "${YELLOW}  cd ../server && make run${NC}"
                exit 1
            fi
            
            # Start frontend and run tests
            npm run test:dev
            exit 0
            ;;
        -t|--test-only)
            echo -e "${YELLOW}Running tests only...${NC}"
            
            # Check all services
            if ! check_service "http://localhost:3000" "Frontend"; then
                echo -e "${RED}❌ Frontend is not running. Please start it first:${NC}"
                echo -e "${YELLOW}  yarn run dev${NC}"
                exit 1
            fi
            
            if ! check_service "http://localhost:8000/docs" "Backend"; then
                echo -e "${RED}❌ Backend is not running. Please start it first:${NC}"
                echo -e "${YELLOW}  cd ../server && make run${NC}"
                exit 1
            fi
            
            # Run tests
            npm run test:e2e:headless
            exit 0
            ;;
        -o|--open)
            echo -e "${YELLOW}Opening Cypress in interactive mode...${NC}"
            
            # Check if frontend is running
            if ! check_service "http://localhost:3000" "Frontend"; then
                echo -e "${YELLOW}Frontend not running. Starting it now...${NC}"
                npm run test:dev:open
            else
                npm run cypress:open
            fi
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Default behavior - show usage
usage 