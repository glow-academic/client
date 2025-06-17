#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Waiting for services to be ready...${NC}"

# Wait for client service
echo -e "${YELLOW}⏳ Waiting for client (http://client:3000)...${NC}"
timeout=60
counter=0
while ! curl -f http://client:3000 >/dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ Client service not ready after ${timeout}s${NC}"
        exit 1
    fi
    echo -e "${YELLOW}   Client not ready, waiting... (${counter}s/${timeout}s)${NC}"
    sleep 2
    counter=$((counter + 2))
done
echo -e "${GREEN}✅ Client service is ready!${NC}"

# Wait for server service
echo -e "${YELLOW}⏳ Waiting for server (http://server:8000)...${NC}"
counter=0
while ! curl -f http://server:8000 >/dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ Server service not ready after ${timeout}s${NC}"
        exit 1
    fi
    echo -e "${YELLOW}   Server not ready, waiting... (${counter}s/${timeout}s)${NC}"
    sleep 2
    counter=$((counter + 2))
done
echo -e "${GREEN}✅ Server service is ready!${NC}"

# Wait for database service
echo -e "${YELLOW}⏳ Waiting for database...${NC}"
counter=0
while ! pg_isready -h database -p 5432 -U "${DB_USER}" >/dev/null 2>&1; do
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}❌ Database service not ready after ${timeout}s${NC}"
        exit 1
    fi
    echo -e "${YELLOW}   Database not ready, waiting... (${counter}s/${timeout}s)${NC}"
    sleep 2
    counter=$((counter + 2))
done
echo -e "${GREEN}✅ Database service is ready!${NC}"

echo -e "${GREEN}🚀 All services are ready! Starting Cypress tests...${NC}"

# Run Cypress tests
exec npm run test:cypress 