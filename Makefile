.PHONY: help setup install clean format lint typecheck run test test-cov cleanup generate-tests stop install-client start-db migrate-db connect-db fresh-db

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

# Run all tests
test: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest on specific file(s): $(ARGS)"; \
		$(VENV_PYTHON) -m pytest $(ARGS) -v; \
	else \
		echo "Running all pytest tests..."; \
		$(VENV_PYTHON) -m pytest server/tests/ -v; \
	fi

# Run tests with coverage
test-cov: check-venv
	@echo "Running pytest tests with coverage..."
	@$(VENV_PYTHON) -m pytest server/tests/ --cov=server/app --cov-report=term-missing --cov-report=html
	@echo "✅ Coverage report generated"


# Start all services in foreground with combined logs
run: check-venv
	@echo "🚀 Starting all GLOW services..."
	@echo "  Redis:    localhost:$(REDIS_PORT)"
	@echo "  Server:   http://localhost:$(SERVER_PORT)"
	@echo "  Client:   http://localhost:$(CLIENT_PORT)"
	@echo "  Database: localhost:$(DATABASE_PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@echo "----------------------------------------"
	@trap 'echo ""; echo "🛑 Stopping all services..."; pkill -f "redis-server.*$(REDIS_PORT)" 2>/dev/null || true; pkill -f "uvicorn.*$(SERVER_PORT)" 2>/dev/null || true; pkill -f "next dev" 2>/dev/null || true; pkill -f "stream-logs.js" 2>/dev/null || true; echo "✅ All services stopped"; exit 0' INT; \
	exec 2>/dev/null; \
	(redis-server --port $(REDIS_PORT) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;31m[REDIS]\033[0m %s' "$$line")"; done) & \
	(cd server && ( $(PWD)/$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(SERVER_PORT)) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;32m[SERVER]\033[0m %s' "$$line")"; done) & \
	(cd client && yarn dev 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;35m[CLIENT]\033[0m %s' "$$line")"; done) & \
	(cd database && READS=1 MIN_MS=0 SAMPLE_MS=150 DEBUG_READS=1 yarn logs 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;33m[DATABASE]\033[0m %s' "$$line")"; done) & \
	wait

# Stop all services (for cleanup)
stop:
	@echo "🛑 Stopping all GLOW services..."
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
	@echo "✅ All services stopped"


# Clean up generated files and cache
cleanup:
	@echo "Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type f -name "*.pyd" -delete 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name ".coverage" -delete 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Install client dependencies
install-client:
	@echo "Installing client dependencies..."
	@cd client && yarn install
	@echo "✅ Client dependencies installed"

# Start database service
start-db:
	@echo "Starting database service..."
	@cd database && yarn start
	@echo "✅ Database started"

# Migrate database
migrate-db:
	@echo "Running database migrations..."
	@cd database && yarn migrate
	@echo "✅ Database migrations completed"

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
	@echo "  start-db     - Start database service"
	@echo "  migrate-db   - Run database migrations"
	@echo "  connect-db   - Connect to database"
	@echo "  fresh-db     - Start database with fresh data"
	@echo ""
	@echo "Services:"
	@echo "  run          - Start all services in foreground (Ctrl+C to stop)"
	@echo "  stop         - Stop all services (cleanup)"
	@echo ""
	@echo "Code quality:"
	@echo "  format       - Format code with Ruff"
	@echo "  lint         - Run linter checks"
	@echo "  typecheck    - Run MyPy for static type checking"
	@echo ""
	@echo "Testing:"
	@echo "  test         - Run all tests"
	@echo "  test-cov     - Run tests with coverage"
	@echo ""
	@echo "Utilities:"
	@echo "  cleanup      - Clean up generated files and cache"
	@echo ""
	@echo "Code generation:"
	@echo "  generate-tests  - Generate pytest tests"
	@echo ""
	@echo "Service URLs:"
	@echo "  Redis:     localhost:$(REDIS_PORT)"
	@echo "  Server:    http://localhost:$(SERVER_PORT)"
	@echo "  Client:    http://localhost:$(CLIENT_PORT)"
	@echo "  Database:  localhost:$(DATABASE_PORT)"
	@echo ""
	@echo "Virtual environment location: $(VENV)"
	@echo "To activate manually: source $(VENV_BIN)/activate"
