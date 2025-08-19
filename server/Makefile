.PHONY: venv dev-tools sync format lint typecheck run prod generate-models clean-venv redis-install redis-start redis-stop check-brew

# Check if venv exists
VENV_EXISTS := $(shell test -d .venv && echo 1 || echo 0)

ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))

# Check if Python 3.11 is available
PY311 := $(shell which python3.11 || true)

# Check if Homebrew is installed
check-brew:
	@if ! command -v brew &> /dev/null; then \
		echo "❌ Homebrew is not installed. Please install it to continue: https://brew.sh/"; \
		exit 1; \
	fi

# Install Redis using Homebrew if not already installed
redis-install: check-brew
	@if ! brew ls --versions redis > /dev/null; then \
		echo "🍺 Installing Redis via Homebrew..."; \
		brew install redis; \
		echo "✅ Redis installed."; \
	else \
		echo "🍺 Redis is already installed."; \
	fi

# Start Redis as a background service on port 6380 by default
redis-start: redis-install
	@echo "🍺 Starting Redis service on port 6380...";
	@redis-server --port 6380 --daemonize yes
	@echo "✅ Redis service started on port 6380."

# Stop the Redis service
redis-stop: check-brew
	@echo "🍺 Stopping Redis service...";
	@brew services stop redis
	@echo "✅ Redis service stopped."

# 1. Ensure the virtual environment exists
venv:
	@if [ $(VENV_EXISTS) -eq 0 ]; then \
		if [ -z "$(PY311)" ]; then \
			echo "❌  python3.11 not found - install it or adjust PY311"; exit 1; \
		fi; \
		echo "Creating virtual environment with Python 3.11: $(PY311)"; \
		uv venv -p $(PY311); \
	fi

# Clean and recreate virtual environment with Python 3.11
clean-venv:
	@echo "Cleaning existing virtual environment..."
	@rm -rf .venv
	@echo "Creating new virtual environment with Python 3.11..."
	@uv venv -p $(PY311)

# 2. Install development tools into the venv
dev-tools: venv
	@uv pip install --upgrade pip --python .venv/bin/python
	@uv pip install uv --python .venv/bin/python

# 3. Sync runtime dependencies
sync: dev-tools
	@echo "Installing dependencies with Python 3.11..."
	@uv pip install -r requirements.txt -r requirements-dev.txt --python .venv/bin/python

# 4. Format code with Ruff and auto-fix issues
format: venv
	@uvx ruff format
	@uvx ruff check --fix

# 5. Run linter checks
lint: venv
	@echo "Running linter..."
	@uvx ruff check .

# 6. Run MyPy for static type checking
typecheck: venv
	@echo "Type checking..."
	@.venv/bin/python -m mypy app --config-file mypy.ini

# Generate SQLModel classes from database schema
generate-models: venv
	@echo "Generating SQLModel classes from database schema..."
	@.venv/bin/python scripts/generate_models.py

# Generate pytest tests for routes and services
generate-tests: venv
	@echo "Generating pytest tests..."
	@.venv/bin/python scripts/generate_pytest_tests.py

# Run all tests
test: sync generate-tests
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest on specific file(s): $(ARGS)"; \
		.venv/bin/python -m pytest $(ARGS) -v; \
	else \
		echo "Running all pytest tests..."; \
		.venv/bin/python -m pytest tests/ -v; \
	fi

# Run tests with coverage
test-cov: sync generate-tests
	@echo "Running pytest tests with coverage..."
	@.venv/bin/python -m pytest tests/ --cov=app --cov-report=term-missing --cov-report=html

# Run the development server with Redis
run: sync generate-models generate-tests redis-start
	@echo "⇢ starting API server on :8000"
	@.venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# convenience - stop all services
stop: redis-stop
	@if [ -f .model.pid ]; then kill `cat .model.pid` || true; rm .model.pid; fi
	@echo "✅ Stopped running processes and Redis service"

# 10. Start FastAPI via Gunicorn+Uvicorn for production
prod: sync redis-start
	@echo "Starting FastAPI server in production mode..."
	@.venv/bin/python -m gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Clean up generated files and cache
clean:
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
	@find . -type f -name ".model.pid" -delete 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Show help
help:
	@echo "GLOW Server - Available commands:"
	@echo ""
	@echo "Environment setup:"
	@echo "  venv         - Create virtual environment"
	@echo "  clean-venv   - Remove and recreate virtual environment"
	@echo "  dev-tools    - Install development tools"
	@echo "  sync         - Install all dependencies"
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
	@echo "Development:"
	@echo "  run          - Start development server with Redis"
	@echo "  prod         - Start production server with Redis"
	@echo "  stop         - Stop running processes and Redis"
	@echo "  clean        - Clean up generated files and cache"
	@echo ""
	@echo "Services (Homebrew):"
	@echo "  redis-install - Install Redis via Homebrew"
	@echo "  redis-start   - Start the Redis service"
	@echo "  redis-stop    - Stop the Redis service"
	@echo ""
	@echo "Code generation:"
	@echo "  generate-models - Generate SQLModel classes from database schema"
	@echo "  generate-tests  - Generate pytest tests"
