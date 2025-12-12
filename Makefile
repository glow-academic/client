.PHONY: help setup install clean format lint typecheck run run-test test test-unit test-integration test-cov cleanup generate-tests generate-test-schema stop stop-keycloak install-client install-e2e restore-db migrate-db migrate-db-all connect-db fresh-db typecheck-client build-client openapi-gen gen-client-types ws-gen gen-ws-types

# Default Python interpreter
PYTHON := python3.11
VENV := .venv
VENV_BIN := $(VENV)/bin
VENV_PYTHON := $(VENV_BIN)/python
VENV_PIP := $(VENV_BIN)/pip

# Service ports
SERVER_PORT := 8000
CLIENT_PORT := 3000
REDIS_PORT := 6380
DATABASE_PORT := 5432
KEYCLOAK_PORT := 8080

# Check if Python 3.11 is available
PY311 := $(shell which python3.11 || true)

# Arguments for test command
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))

# Check if Python 3.11 is available
check-python:
	@if [ -z "$(PY311)" ]; then \
		echo "❌  python3.11 not found - please install Python 3.11"; \
		exit 1; \
	fi

# Create virtual environment
setup: check-python
	@echo "Creating virtual environment at $(VENV)..."
	@$(PYTHON) -m venv $(VENV)
	@echo "✅ Virtual environment created at $(VENV)"
	@echo "To activate: source $(VENV_BIN)/activate"

# Install all dependencies
install: check-venv
	@echo "Installing all dependencies..."
	@$(VENV_PIP) install --upgrade pip
	@$(VENV_PIP) install -e .
	@echo "✅ All dependencies installed"

# Clean virtual environment
clean:
	@echo "Removing virtual environment..."
	@rm -rf $(VENV)
	@echo "✅ Virtual environment removed"

# Check if virtual environment exists
check-venv:
	@if [ ! -d "$(VENV)" ]; then \
		echo "❌ Virtual environment not found at $(VENV)"; \
		echo "Run 'make setup' to create it"; \
		exit 1; \
	fi
	@if [ ! -f "$(VENV_PYTHON)" ]; then \
		echo "❌ Python not found in virtual environment at $(VENV_PYTHON)"; \
		echo "Run 'make setup' to recreate the virtual environment"; \
		exit 1; \
	fi

# Format code with Ruff
format: check-venv
	@echo "Formatting code with Ruff..."
	@$(VENV_PYTHON) -m ruff format .
	@$(VENV_PYTHON) -m ruff check --fix .
	@echo "✅ Code formatted"

# Run linter checks
lint: check-venv
	@echo "Running linter..."
	@$(VENV_PYTHON) -m ruff check .
	@echo "✅ Linting complete"

# Run MyPy for static type checking
typecheck: check-venv
	@echo "Type checking..."
	@$(VENV_PYTHON) -m mypy server/app
	@echo "✅ Type checking complete"


# Generate pytest tests for routes and services
generate-tests: check-venv
	@echo "Generating pytest tests..."
	@$(VENV_PYTHON) server/scripts/generate_pytest_tests.py
	@echo "✅ Tests generated"

# Generate consolidated test schema SQL file
generate-test-schema:
	@echo "Generating test schema with seed data..."
	@cd database && yarn generate-test-schema
	@echo "✅ Test schema generated at server/tests/test-schema.sql"

# Test paths (DRY)
UNIT_TEST_PATH = server/tests/unit
INTEGRATION_TEST_PATH = server/tests/integration
E2E_TEST_PATH = server/tests/e2e

# Run unit tests
test-unit: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running unit tests on: $(ARGS)"; \
		$(VENV_PYTHON) -m pytest $(ARGS) -v; \
	else \
		echo "Running unit tests..."; \
		$(VENV_PYTHON) -m pytest $(UNIT_TEST_PATH) -v; \
	fi

# Run integration tests
test-integration: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running integration tests on: $(ARGS)"; \
		$(VENV_PYTHON) -m pytest $(ARGS) -v; \
	else \
		echo "Running integration tests..."; \
		$(VENV_PYTHON) -m pytest $(INTEGRATION_TEST_PATH) -v; \
	fi

# Run all tests (unit + integration)
test: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest on specific file(s): $(ARGS)"; \
		$(VENV_PYTHON) -m pytest $(ARGS) -v; \
	else \
		$(MAKE) test-unit; \
		$(MAKE) test-integration; \
	fi

# Run tests with coverage (unit + integration only, excludes e2e)
test-cov: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest with coverage on: $(ARGS)"; \
		COVERAGE_FILE=server/.coverage $(VENV_PYTHON) -m pytest $(ARGS) --cov=server/app --cov-report=term-missing --cov-report=html:server/htmlcov -m "not e2e"; \
	else \
		echo "Running unit and integration tests with coverage..."; \
		COVERAGE_FILE=server/.coverage $(VENV_PYTHON) -m pytest $(UNIT_TEST_PATH) $(INTEGRATION_TEST_PATH) --cov=server/app --cov-report=term-missing --cov-report=html:server/htmlcov; \
	fi
	@echo "✅ Coverage report generated at server/htmlcov/index.html"

test-e2e: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running E2E tests (headless) on: $(ARGS)"; \
		ENV=test AUTH_SECRET=test_secret_key_for_integration_tests SECRET_KEY=test_secret_key_for_integration_tests $(VENV_PYTHON) -m pytest $(ARGS) -m e2e -q; \
	else \
		echo "Running E2E tests (headless)..."; \
		ENV=test AUTH_SECRET=test_secret_key_for_integration_tests SECRET_KEY=test_secret_key_for_integration_tests $(VENV_PYTHON) -m pytest $(E2E_TEST_PATH) -m e2e -q; \
	fi
	@echo "✅ E2E tests complete"

test-e2e-headed: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running E2E tests (headed) on: $(ARGS)"; \
		ENV=test AUTH_SECRET=test_secret_key_for_integration_tests SECRET_KEY=test_secret_key_for_integration_tests E2E_HEADED=1 $(VENV_PYTHON) -m pytest $(ARGS) -m e2e -q --headed; \
	else \
		echo "Running E2E tests (headed)..."; \
		ENV=test AUTH_SECRET=test_secret_key_for_integration_tests SECRET_KEY=test_secret_key_for_integration_tests E2E_HEADED=1 $(VENV_PYTHON) -m pytest $(E2E_TEST_PATH) -m e2e -q --headed; \
	fi
	@echo "✅ E2E tests complete"
# Run client typecheck
typecheck-client:
	@echo "Running client typecheck..."
	@cd client && yarn typecheck
	@echo "✅ Client typecheck complete"

# Build client for production
build-client:
	@echo "Building client for production..."
	@cd client && yarn build
	@echo "✅ Client build complete"

install-e2e: check-venv
	@echo "Installing Playwright browsers..."
	@$(VENV_BIN)/playwright install
	@echo "✅ Playwright browsers installed"

# Generate OpenAPI schema manually
openapi-gen: check-venv
	@echo "📝 Generating OpenAPI schema..."
	@cd server && $(PWD)/$(VENV_PYTHON) -c "import json; \
from fastapi.openapi.utils import get_openapi; \
from app.main import fastapi_app; \
import pathlib; \
p = pathlib.Path('openapi.json'); \
p.write_text(json.dumps(get_openapi(title=fastapi_app.title, version='0.1.0', routes=fastapi_app.routes, description='Auto-generated OpenAPI schema'), indent=2)); \
print('✅ openapi.json written to', p.resolve())"

# Generate client TypeScript types from OpenAPI
gen-client-types:
	@echo "📝 Generating client TypeScript types from OpenAPI..."
	@cd client && yarn gen:types
	@echo "✅ Client types updated in lib/api/schema.ts"

# Generate WebSocket contract manually
ws-gen: check-venv
	@echo "📝 Generating WebSocket contract..."
	@cd server && $(PWD)/$(VENV_PYTHON) -c "import asyncio; \
from app.main import lifespan, fastapi_app; \
async def run(): \
	async with lifespan(fastapi_app): \
		pass; \
asyncio.run(run())"
	@echo "✅ ws.json written to server/ws.json"

# Generate client TypeScript types from WebSocket contract
gen-ws-types:
	@echo "📝 Generating client TypeScript types from WebSocket contract..."
	@cd client && yarn gen:ws-types
	@echo "✅ Client WebSocket types updated in lib/ws-types.ts"

# Start all services in foreground with combined logs
run: check-venv
	@echo "🚀 Starting all GLOW services..."
	@echo "  Redis:    localhost:$(REDIS_PORT)"
	@echo "  Server:   http://localhost:$(SERVER_PORT)"
	@echo "  Client:   http://localhost:$(CLIENT_PORT)"
	@echo "  Database: localhost:$(DATABASE_PORT)"
	@echo "  Keycloak: http://localhost:$(KEYCLOAK_PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@echo "----------------------------------------"
	@trap 'echo ""; echo "🛑 Stopping all services..."; pkill -f "redis-server.*$(REDIS_PORT)" 2>/dev/null || true; pkill -f "uvicorn.*$(SERVER_PORT)" 2>/dev/null || true; pkill -f "next dev" 2>/dev/null || true; pkill -f "chokidar.*openapi.json" 2>/dev/null || true; pkill -f "chokidar.*ws.json" 2>/dev/null || true; pkill -f "stream-logs.js" 2>/dev/null || true; pkill -f "docker logs.*glow-keycloak" 2>/dev/null || true; echo "✅ All services stopped (Keycloak remains running)"; exit 0' INT; \
	exec 2>/dev/null; \
	if docker ps --filter name=glow-keycloak --format "{{.Names}}" | grep -q "^glow-keycloak$$"; then \
		echo "✅ Keycloak already running, attaching to logs..."; \
		(docker logs --tail 0 -f glow-keycloak 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;34m[KEYCLOAK]\033[0m %s' "$$line")"; done) & \
	elif docker ps -a --filter name=glow-keycloak --format "{{.Names}}" | grep -q "^glow-keycloak$$"; then \
		echo "🔄 Starting existing Keycloak container..."; \
		docker start glow-keycloak >/dev/null 2>&1; \
		sleep 1; \
		(docker logs --tail 0 -f glow-keycloak 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;34m[KEYCLOAK]\033[0m %s' "$$line")"; done) & \
	else \
		echo "🚀 Creating new Keycloak container (persistent, use 'make stop-keycloak' to stop)..."; \
		DB_USER=$${DB_USER:-myuser}; \
		DB_PASSWORD=$${DB_PASSWORD:-mypassword}; \
		CLIENT_PORT=$${CLIENT_PORT:-3000}; \
		APP_PREFIX=$${APP_PREFIX:-}; \
		docker run -d --name glow-keycloak -p $(KEYCLOAK_PORT):8080 \
			-e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
			-e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
			-e KC_DB=postgres \
			-e KC_DB_URL=jdbc:postgresql://host.docker.internal:5432/keycloak \
			-e KC_DB_USERNAME=$$DB_USER \
			-e KC_DB_PASSWORD=$$DB_PASSWORD \
			-e KC_PROXY=none \
			-e KC_HTTP_ENABLED=true \
			-e KC_HTTP_RELATIVE_PATH=$${APP_PREFIX}/auth \
			-e KC_HOSTNAME=http://localhost:$$CLIENT_PORT$${APP_PREFIX}/auth \
			-e KC_HOSTNAME_STRICT=false \
			-e KC_HOSTNAME_STRICT_BACKCHANNEL=false \
			quay.io/keycloak/keycloak:26.0 start-dev >/dev/null 2>&1; \
		sleep 1; \
		(docker logs --tail 0 -f glow-keycloak 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;34m[KEYCLOAK]\033[0m %s' "$$line")"; done) & \
	fi; \
	(cd server && redis-server --port $(REDIS_PORT) --dir . --dbfilename dump.rdb 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;31m[REDIS]\033[0m %s' "$$line")"; done) & \
	(cd server && ( $(PWD)/$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(SERVER_PORT) --reload-exclude server/openapi.json --reload-exclude server/ws.json) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;32m[SERVER]\033[0m %s' "$$line")"; done) & \
	(cd client && yarn watch:openapi 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;36m[OPENAPI]\033[0m %s' "$$line")"; done) & \
	(cd client && yarn watch:ws 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;36m[WS]\033[0m %s' "$$line")"; done) & \
	(cd client && NODE_OPTIONS='--dns-result-order=ipv4first' yarn dev 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;35m[CLIENT]\033[0m %s' "$$line")"; done) & \
	(cd database && READS=1 MIN_MS=0 SAMPLE_MS=150 DEBUG_READS=1 yarn logs 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;33m[DATABASE]\033[0m %s' "$$line")"; done) & \
	wait

run-test:
	@echo "🚀 Starting all GLOW services in TEST mode..."
	@ENV=test AUTH_SECRET=test_secret_key_for_integration_tests SECRET_KEY=test_secret_key_for_integration_tests $(MAKE) run

# Stop all services (for cleanup)
stop:
	@echo "🛑 Stopping all GLOW services (Keycloak will remain running)..."
	@echo "Stopping Redis on port $(REDIS_PORT)..."
	@if lsof -ti:$(REDIS_PORT) >/dev/null 2>&1; then \
		kill -9 $$(lsof -ti:$(REDIS_PORT)) 2>/dev/null && echo "✅ Redis stopped" || echo "⚠️  Redis process not found"; \
	else \
		echo "⚠️  No process found on port $(REDIS_PORT)"; \
	fi
	@echo "Stopping Server on port $(SERVER_PORT)..."
	@if lsof -ti:$(SERVER_PORT) >/dev/null 2>&1; then \
		kill -9 $$(lsof -ti:$(SERVER_PORT)) 2>/dev/null && echo "✅ Server stopped" || echo "⚠️  Server process not found"; \
	else \
		echo "⚠️  No process found on port $(SERVER_PORT)"; \
	fi
	@echo "Stopping Client on port $(CLIENT_PORT)..."
	@if lsof -ti:$(CLIENT_PORT) >/dev/null 2>&1; then \
		kill -9 $$(lsof -ti:$(CLIENT_PORT)) 2>/dev/null && echo "✅ Client stopped" || echo "⚠️  Client process not found"; \
	else \
		echo "⚠️  No process found on port $(CLIENT_PORT)"; \
	fi
	@echo "Stopping Database logs..."
	@pkill -f "stream-logs.js" 2>/dev/null && echo "✅ Database logs stopped" || echo "⚠️  Database logs process not found"
	@echo "✅ All services stopped (Keycloak remains running)"

# Stop Keycloak container
stop-keycloak:
	@echo "Stopping Keycloak..."
	@if docker ps -a --filter name=glow-keycloak --format "{{.Names}}" | grep -q "^glow-keycloak$$"; then \
		docker stop glow-keycloak >/dev/null 2>&1 && echo "✅ Keycloak stopped" || echo "⚠️  Failed to stop Keycloak"; \
		docker rm glow-keycloak >/dev/null 2>&1 && echo "✅ Keycloak container removed" || echo "⚠️  Failed to remove Keycloak container"; \
	else \
		echo "⚠️  Keycloak container not found"; \
	fi

# Clean up generated files and cache
cleanup:
	@echo "Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type f -name "*.pyd" -delete 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf server/.pytest_cache server/.mypy_cache server/.ruff_cache 2>/dev/null || true
	@rm -rf server/htmlcov server/.coverage 2>/dev/null || true
	@rm -f server/dump.rdb 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Install client dependencies
install-client:
	@echo "Installing client dependencies..."
	@cd client && yarn install
	@echo "✅ Client dependencies installed"

# Restore database from latest backup
restore-db:
	@echo "Restoring database from latest backup..."
	@cd database && yarn start
	@echo "✅ Database restored"

# Migrate database (most recent migration only)
migrate-db:
	@echo "Running database migrations (most recent only)..."
	@cd database && yarn migrate
	@echo "✅ Database migrations completed"

# Migrate database (all migrations)
migrate-db-all:
	@echo "Running all database migrations..."
	@cd database && yarn migrate:all
	@echo "✅ All database migrations completed"

# Connect to database
connect-db:
	@echo "Connecting to database..."
	@cd database && yarn connect
	@echo "✅ Connected to database"

# Start database with fresh data (clean start)
fresh-db:
	@echo "Starting database with fresh data..."
	@cd database && yarn start:clean
	@echo "✅ Fresh database started"


# Show help
help:
	@echo "GLOW - Graduate Learning Orientation Workshop"
	@echo ""
	@echo "Environment setup:"
	@echo "  setup        - Create virtual environment at .venv"
	@echo "  install      - Install all dependencies in venv"
	@echo "  clean        - Remove virtual environment"
	@echo ""
	@echo "Client setup:"
	@echo "  install-client - Install client dependencies with yarn"
	@echo ""
	@echo "Database:"
	@echo "  restore-db     - Restore database from latest backup"
	@echo "  migrate-db     - Run most recent database migration"
	@echo "  migrate-db-all - Run all database migrations"
	@echo "  connect-db     - Connect to database"
	@echo "  fresh-db       - Start database with fresh data"
	@echo ""
	@echo "Services:"
	@echo "  run          - Start all services in foreground (Ctrl+C to stop)"
	@echo "  stop         - Stop all services except Keycloak (cleanup)"
	@echo "  stop-keycloak - Stop Keycloak container"
	@echo ""
	@echo "Code quality:"
	@echo "  format       - Format code with Ruff"
	@echo "  lint         - Run linter checks"
	@echo "  typecheck    - Run MyPy for static type checking"
	@echo "  typecheck-client - Run TypeScript type checking for client"
	@echo ""
	@echo "Testing:"
	@echo "  test         - Run server unit tests (pytest)"
	@echo "  test-cov     - Run server tests with coverage"
	@echo ""
	@echo "Build:"
	@echo "  build-client - Build client for production"
	@echo ""
	@echo "Utilities:"
	@echo "  cleanup      - Clean up generated files and cache"
	@echo ""
	@echo "Code generation:"
	@echo "  generate-tests  - Generate pytest tests"
	@echo "  openapi-gen      - Generate OpenAPI schema manually"
	@echo "  gen-client-types - Generate client TypeScript types from OpenAPI"
	@echo "  ws-gen           - Generate WebSocket contract manually"
	@echo "  gen-ws-types     - Generate client TypeScript types from WebSocket contract"
	@echo ""
	@echo "Service URLs:"
	@echo "  Redis:     localhost:$(REDIS_PORT)"
	@echo "  Server:    http://localhost:$(SERVER_PORT)"
	@echo "  Client:    http://localhost:$(CLIENT_PORT)"
	@echo "  Database:  localhost:$(DATABASE_PORT)"
	@echo "  Keycloak:  http://localhost:$(KEYCLOAK_PORT)"
	@echo ""
	@echo "Virtual environment location: $(VENV)"
	@echo "To activate manually: source $(VENV_BIN)/activate"
